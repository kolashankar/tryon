#!/usr/bin/env python3
import requests
import base64
import sys
from datetime import datetime
import json
import time

class RegionalOutfitAPITester:
    def __init__(self, base_url="https://dress-world-ai.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"  Details: {details}")

    def run_test(self, name, method, endpoint, expected_status=200, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {}
        
        print(f"\n🔍 Testing {name}")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files, timeout=30)
                else:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True, f"Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {"raw_content": response.content}
            else:
                error_detail = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_content = response.json()
                    error_detail += f" - Response: {error_content}"
                except:
                    error_detail += f" - Response: {response.text[:200]}"
                
                self.log_test(name, False, error_detail)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Network error: {str(e)}")
            return False, {}

    def create_sample_base64_image(self):
        """Create a minimal valid base64 encoded image for testing"""
        # This is a minimal 1x1 PNG image
        minimal_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\x12IDATx\x9cc```bPPP\x00\x02\xd2\x00\x05\xc5\x0e\x00\x02\x8a\x00\x01\x02Z\xdd\xdf\x00\x00\x00\x00IEND\xaeB`\x82'
        return base64.b64encode(minimal_png).decode('utf-8')

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint", 
            "GET", 
            "/",
            200
        )
        if success and "message" in response:
            print(f"   Message: {response['message']}")
        return success

    def test_status_endpoint(self):
        """Test status endpoints"""
        # Test GET status
        get_success, _ = self.run_test(
            "GET Status Checks",
            "GET",
            "/status",
            200
        )
        
        # Test POST status
        status_data = {
            "client_name": f"test_client_{datetime.now().strftime('%H%M%S')}"
        }
        
        post_success, response = self.run_test(
            "POST Status Check",
            "POST", 
            "/status",
            200,
            data=status_data
        )
        
        return get_success and post_success

    def test_transform_endpoint(self):
        """Test image transformation endpoint"""
        # Create sample base64 image
        sample_image = self.create_sample_base64_image()
        
        transform_data = {
            "image_base64": sample_image,
            "region": "India", 
            "style": "Saree"
        }
        
        print(f"   Testing transformation with region: {transform_data['region']}, style: {transform_data['style']}")
        
        success, response = self.run_test(
            "Image Transformation",
            "POST",
            "/transform", 
            200,
            data=transform_data
        )
        
        if success and response.get('success'):
            if 'transformed_image' in response:
                print(f"   ✅ Transformation successful, image generated")
                return True
            else:
                self.log_test("Image Transformation", False, "No transformed_image in response")
                return False
        
        return success

    def test_download_project_endpoint(self):
        """Test project download endpoint"""
        print(f"\n🔍 Testing Project Download Endpoint")
        print(f"   URL: {self.base_url}/download-project")
        
        try:
            response = requests.get(f"{self.base_url}/download-project", timeout=60)
            
            if response.status_code == 200:
                # Check if it's a ZIP file
                content_type = response.headers.get('content-type', '')
                content_disposition = response.headers.get('content-disposition', '')
                
                if 'zip' in content_type or 'zip' in content_disposition:
                    zip_size = len(response.content)
                    self.log_test("Project Download", True, f"ZIP file received, size: {zip_size} bytes")
                    return True
                else:
                    self.log_test("Project Download", False, f"Invalid content type: {content_type}")
                    return False
            else:
                self.log_test("Project Download", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Project Download", False, f"Error: {str(e)}")
            return False

    def run_comprehensive_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Comprehensive Backend API Testing")
        print(f"📍 Base URL: {self.base_url}\n")
        
        # Test 1: Root endpoint
        self.test_root_endpoint()
        
        # Test 2: Status endpoints 
        self.test_status_endpoint()
        
        # Test 3: Transform endpoint (main functionality)
        self.test_transform_endpoint()
        
        # Test 4: Download project endpoint
        self.test_download_project_endpoint()
        
        # Print final results
        print(f"\n📊 Final Results:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed, self.tests_run, self.test_results

def main():
    tester = RegionalOutfitAPITester()
    passed, total, results = tester.run_comprehensive_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "summary": f"Backend API testing completed - {passed}/{total} tests passed",
            "success_rate": f"{(passed/total*100):.1f}%",
            "test_results": results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n📋 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    exit_code = main()
    print(f"\n🏁 Backend testing completed with exit code: {exit_code}")
    sys.exit(exit_code)