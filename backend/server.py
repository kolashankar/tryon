from fastapi import FastAPI, APIRouter, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import base64
import asyncio
import zipfile
import io
from PIL import Image
from google import genai
from google.genai import types

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class TransformRequest(BaseModel):
    image_base64: str
    region: str
    style: str
    gender: str

class TransformResponse(BaseModel):
    transformed_image: str
    success: bool
    message: str = ""

# Add routes
@api_router.get("/")
async def root():
    return {"message": "CultureShift AI - Regional Outfit Transformation"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

@api_router.post("/transform", response_model=TransformResponse)
async def transform_image(request: TransformRequest):
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
        
        # Initialize Gemini client
        client = genai.Client(api_key=api_key)
        
        # Decode base64 image for preprocessing
        try:
            image_bytes = base64.b64decode(request.image_base64)
            image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if necessary (remove alpha channel)
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Resize if too large (max 3072x3072 for Gemini)
            max_size = 2048  # Use 2048 to be safe
            if image.width > max_size or image.height > max_size:
                image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            
            # Save to bytes for API
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG', quality=95)
            img_byte_arr.seek(0)
            
        except Exception as e:
            logger.error(f"Image preprocessing error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")
        
        # Create transformation prompt
        prompt = f"""Transform this {request.gender.lower()} person's outfit to {request.region} - {request.style} style.

CRITICAL REQUIREMENTS:
- Maintain 100% EXACT same face, facial features, and facial structure
- Keep the person's natural skin tone but adjust subtly to match the regional aesthetic
- Apply the {request.style} traditional {request.gender.lower()} outfit from {request.region}
- Use cinematic, professional lighting with soft shadows
- Create photorealistic rendering with high attention to fabric textures and details
- Ensure the outfit fits naturally on the person's body
- Keep the background simple and complementary to the outfit
- Make it look like a professional portrait photograph
- The outfit should be appropriate for {request.gender.lower()} and culturally accurate

The result should look like the same person wearing traditional {request.region} {request.style} {request.gender.lower()} attire in a professional photo shoot.

Please generate a transformed image based on these requirements."""
        
        # Create image part
        image_part = types.Part.from_bytes(
            data=img_byte_arr.getvalue(),
            mime_type="image/jpeg"
        )
        
        # Configure generation to return both text and image
        generation_config = types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            temperature=0.7
        )
        
        # Generate content with image using gemini-2.5-flash-image (Nano Banana)
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-2.5-flash-image',
            contents=[image_part, prompt],
            config=generation_config
        )
        
        # Check if response contains generated image
        if hasattr(response, 'candidates') and len(response.candidates) > 0:
            candidate = response.candidates[0]
            
            # Check for image parts in the response
            if hasattr(candidate.content, 'parts'):
                for part in candidate.content.parts:
                    # Check if part contains inline data (image)
                    if hasattr(part, 'inline_data') and part.inline_data:
                        image_data = part.inline_data.data
                        # Convert bytes to base64 if necessary
                        if isinstance(image_data, bytes):
                            transformed_image_base64 = base64.b64encode(image_data).decode('utf-8')
                        else:
                            transformed_image_base64 = image_data
                        
                        return TransformResponse(
                            transformed_image=transformed_image_base64,
                            success=True,
                            message="Transformation completed successfully"
                        )
        
        # If no image generated, check for text response
        if hasattr(response, 'text') and response.text:
            logger.error(f"Gemini returned text instead of image: {response.text}")
            raise HTTPException(
                status_code=500, 
                detail="Gemini model returned text instead of image. Try using a different prompt or image."
            )
        else:
            raise HTTPException(status_code=500, detail="No image generated by Gemini")
            
    except Exception as e:
        logger.error(f"Transformation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")

@api_router.get("/download-project")
async def download_project():
    """Create and download a ZIP of the entire project"""
    try:
        # Create a BytesIO object to store the ZIP
        zip_buffer = io.BytesIO()
        
        # Patterns to exclude
        exclude_patterns = [
            'node_modules', '__pycache__', '.git', '.emergent', 'venv',
            '*.log', '*.pyc', '.pytest_cache', 'build', 'dist', '*.egg-info'
        ]
        
        def should_exclude(path_str):
            """Check if path should be excluded"""
            for pattern in exclude_patterns:
                if pattern.startswith('*.'):
                    # File extension pattern
                    if path_str.endswith(pattern[1:]):
                        return True
                else:
                    # Directory or name pattern
                    if pattern in path_str.split('/'):
                        return True
            return False
        
        # Create ZIP file
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            app_dir = Path('/app')
            for file_path in app_dir.rglob('*'):
                if file_path.is_file():
                    relative_path = file_path.relative_to(app_dir)
                    if not should_exclude(str(relative_path)):
                        zip_file.write(file_path, arcname=relative_path)
        
        # Reset buffer position
        zip_buffer.seek(0)
        
        # Return as streaming response
        return StreamingResponse(
            iter([zip_buffer.getvalue()]),
            media_type="application/zip",
            headers={
                "Content-Disposition": "attachment; filename=project.zip"
            }
        )
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create project ZIP: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()