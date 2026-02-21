import { useState } from 'react';
import '@/App.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, Download, RefreshCw, ChevronRight, User, Users } from 'lucide-react';
import axios from 'axios';
import { toast, Toaster } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Regional data with 10 styles each for male and female
const REGIONS_STYLES = {
  India: {
    male: ['Kurta Pajama', 'Sherwani', 'Dhoti Kurta', 'Bandhgala', 'Nehru Jacket', 'Pathani Suit', 'Achkan', 'Jodhpuri Suit', 'Lungi', 'Mundu'],
    female: ['Saree', 'Lehenga', 'Anarkali', 'Salwar Kameez', 'Sharara', 'Gharara', 'Pattu Pavadai', 'Kerala Kasavu', 'Chaniya Choli', 'Kurti']
  },
  Japan: {
    male: ['Kimono', 'Hakama', 'Samue', 'Jinbei', 'Haori', 'Montsuki', 'Yukata', 'Kataginu', 'Nagagi', 'Happi'],
    female: ['Kimono', 'Yukata', 'Furisode', 'Tomesode', 'Uchikake', 'Houmongi', 'Mofuku', 'Susohiki', 'Komon', 'Tsukesage']
  },
  'Middle East': {
    male: ['Thobe', 'Dishdasha', 'Kandura', 'Bisht', 'Jalabiya', 'Ghutra Style', 'Izar', 'Sirwal', 'Agal Outfit', 'Emirati Kandura'],
    female: ['Abaya', 'Kaftan', 'Jalabiya', 'Hijab Style', 'Takchita', 'Niqab Style', 'Burqa Style', 'Dubai Abaya', 'Moroccan Kaftan', 'Saudi Abaya']
  },
  Africa: {
    male: ['Dashiki', 'Agbada', 'Boubou', 'Kanzu', 'Djellaba', 'Senegalese Boubou', 'Nigerian Agbada', 'Kikoi', 'Kente Cloth', 'Bui Bui'],
    female: ['Dashiki', 'Kaftan', 'Boubou', 'Kente Dress', 'Ankara Dress', 'Kitenge', 'Shuka Wrap', 'Gomesi', 'Djellaba', 'Habesha Kemis']
  },
  China: {
    male: ['Tang Suit', 'Changshan', 'Zhongshan Suit', 'Hanfu', 'Mao Suit', 'Daopao', 'Shenyi', 'Kuzhe', 'Pao', 'Magua'],
    female: ['Qipao', 'Cheongsam', 'Hanfu', 'Ruqun', 'Mamianqun', 'Aoqun', 'Beizi', 'Banbi', 'Duijin', 'Quju']
  },
  Korea: {
    male: ['Hanbok', 'Durumagi', 'Dopo', 'Jeogori', 'Baji', 'Jokki', 'Magoja', 'Gwanbok', 'Samo', 'Daenggi Style'],
    female: ['Hanbok', 'Jeogori', 'Chima', 'Dangui', 'Wonsam', 'Hwarot', 'Saekdongot', 'Jeogori Chima', 'Hanbok Dress', 'Modern Hanbok']
  },
  Europe: {
    male: ['Medieval Tunic', 'Doublet', 'Breeches', 'Kilt', 'Lederhosen', 'Toga', 'Viking Tunic', 'Renaissance Outfit', 'Cossack', 'Hussar Uniform'],
    female: ['Victorian Dress', 'Medieval Gown', 'Renaissance Dress', 'Dirndl', 'Ball Gown', 'Toga', 'Flapper Dress', 'Empire Dress', 'Bustle Dress', 'Tudor Gown']
  },
  'Latin America': {
    male: ['Guayabera', 'Poncho', 'Gaucho', 'Charro', 'Mariachi', 'Bombacha', 'Ruana', 'Sombrero Outfit', 'Huaso', 'Llanero'],
    female: ['Huipil', 'Pollera', 'Ranchera Dress', 'Tehuana', 'China Poblana', 'Jarocha Dress', 'Adelita Dress', 'Escaramuza', 'Peruvian Dress', 'Mola Dress']
  },
  'Southeast Asia': {
    male: ['Barong Tagalog', 'Batik Shirt', 'Sarong', 'Baju Melayu', 'Longyi', 'Sinh', 'Sampot', 'Pha Nung', 'Vietnamese Ao Dai', 'Javanese Beskap'],
    female: ['Kebaya', 'Baju Kurung', 'Batik Dress', 'Ao Dai', 'Sinh', 'Sampot', 'Sarong Dress', 'Maria Clara', 'Pha Nung', 'Longyi']
  },
  'Indigenous/Tribal': {
    male: ['Native American', 'Maori Warrior', 'Aboriginal', 'Inuit Parka', 'Sami Gakti', 'Zulu Warrior', 'Himba', 'Bedouin', 'Polynesian', 'Berber'],
    female: ['Native American', 'Maori Traditional', 'Aboriginal', 'Inuit Amauti', 'Sami Gakti', 'Zulu Traditional', 'Himba', 'Polynesian', 'Berber', 'Tuareg']
  }
};

const REGION_NAMES = Object.keys(REGIONS_STYLES);

function App() {
  const [selectedGender, setSelectedGender] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [transformedImage, setTransformedImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle gender selection
  const handleGenderSelect = (gender) => {
    setSelectedGender(gender);
    // Reset subsequent selections
    setUploadedImage(null);
    setUploadedImageBase64('');
    setSelectedRegion('');
    setSelectedStyle('');
    setTransformedImage(null);
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
        
        // Convert to base64 without data URI prefix for API
        const base64String = event.target.result.split(',')[1];
        setUploadedImageBase64(base64String);
      };
      reader.readAsDataURL(file);
      setTransformedImage(null);
    } else {
      toast.error('Please upload a valid image file (JPG, PNG)');
    }
  };

  // Handle region selection
  const handleRegionSelect = (region) => {
    setSelectedRegion(region);
    setSelectedStyle('');
  };

  // Handle transformation
  const handleTransform = async () => {
    if (!selectedGender) {
      toast.error('Please select gender first');
      return;
    }
    if (!uploadedImageBase64) {
      toast.error('Please upload an image');
      return;
    }
    if (!selectedRegion) {
      toast.error('Please select a region');
      return;
    }
    if (!selectedStyle) {
      toast.error('Please select a style');
      return;
    }

    setIsGenerating(true);
    toast.loading('Transforming your image...', { id: 'transform' });

    try {
      const response = await axios.post(`${API}/transform`, {
        image_base64: uploadedImageBase64,
        region: selectedRegion,
        style: selectedStyle,
        gender: selectedGender,
      });

      if (response.data.success) {
        // Add data URI prefix for display
        const transformedImageData = `data:image/png;base64,${response.data.transformed_image}`;
        setTransformedImage(transformedImageData);
        toast.success('Transformation complete!', { id: 'transform' });
      } else {
        toast.error(response.data.message || 'Transformation failed', { id: 'transform' });
      }
    } catch (error) {
      console.error('Transform error:', error);
      toast.error(error.response?.data?.detail || 'Failed to transform image', { id: 'transform' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle download
  const handleDownload = () => {
    if (!transformedImage) return;
    
    const link = document.createElement('a');
    link.href = transformedImage;
    link.download = `${selectedRegion}-${selectedStyle}-${selectedGender}-transformed.png`;
    link.click();
    toast.success('Image downloaded!');
  };

  return (
    <div className="min-h-screen bg-[#030304] text-white overflow-hidden">
      <Toaster position="top-center" theme="dark" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 h-screen">
        {/* Left Sidebar - Controls */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-4 bg-[#0E0E10] border-r border-[#27272A] overflow-y-auto p-6 space-y-6"
        >
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold font-syne tracking-tighter text-[#DFFF00] neon-text" data-testid="app-title">
              CultureShift AI
            </h1>
            <p className="text-sm text-[#A1A1AA] mt-2 font-space" data-testid="app-subtitle">
              Transform your look across 10 global regions
            </p>
          </div>

          {/* Gender Selection */}
          <div className="space-y-3">
            <label className="text-xs font-mono uppercase tracking-widest text-[#DFFF00]" data-testid="gender-label">
              01 — Select Gender
            </label>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGenderSelect('Male')}
                className={`p-4 rounded-lg border transition-all ${
                  selectedGender === 'Male'
                    ? 'bg-[#DFFF00] text-black border-[#DFFF00] neon-glow'
                    : 'bg-[#18181B] text-white border-[#27272A] hover:border-[#DFFF00]'
                }`}
                data-testid="gender-male"
              >
                <User className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Male</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGenderSelect('Female')}
                className={`p-4 rounded-lg border transition-all ${
                  selectedGender === 'Female'
                    ? 'bg-[#DFFF00] text-black border-[#DFFF00] neon-glow'
                    : 'bg-[#18181B] text-white border-[#27272A] hover:border-[#DFFF00]'
                }`}
                data-testid="gender-female"
              >
                <Users className="w-6 h-6 mx-auto mb-2" />
                <span className="text-sm font-medium">Female</span>
              </motion.button>
            </div>
          </div>

          {/* Upload Section - Only show after gender selection */}
          {selectedGender && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <label className="text-xs font-mono uppercase tracking-widest text-[#DFFF00]" data-testid="upload-label">
                02 — Upload Photo
              </label>
              <label
                htmlFor="image-upload"
                className="border-2 border-dashed border-[#27272A] hover:border-[#DFFF00] rounded-xl flex flex-col items-center justify-center h-48 cursor-pointer transition-all group"
                data-testid="upload-zone"
              >
                {uploadedImage ? (
                  <img
                    src={uploadedImage}
                    alt="Uploaded"
                    className="w-full h-full object-cover rounded-xl"
                    data-testid="uploaded-image-preview"
                  />
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-[#A1A1AA] group-hover:text-[#DFFF00] transition-colors" />
                    <p className="text-sm text-[#A1A1AA] mt-2">Click or drag to upload</p>
                    <p className="text-xs text-[#A1A1AA] mt-1">JPG, PNG</p>
                  </>
                )}
              </label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="image-upload-input"
              />
            </motion.div>
          )}

          {/* Region Selector - Only show after upload */}
          {uploadedImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <label className="text-xs font-mono uppercase tracking-widest text-[#DFFF00]" data-testid="region-label">
                03 — Select Region
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REGION_NAMES.map((region) => (
                  <motion.button
                    key={region}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRegionSelect(region)}
                    className={`p-3 rounded-lg border transition-all text-sm font-medium ${
                      selectedRegion === region
                        ? 'bg-[#DFFF00] text-black border-[#DFFF00] neon-glow'
                        : 'bg-[#18181B] text-white border-[#27272A] hover:border-[#DFFF00]'
                    }`}
                    data-testid={`region-${region.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}
                  >
                    {region}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Style Selector - Only show after region selection */}
          {selectedRegion && selectedGender && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <label className="text-xs font-mono uppercase tracking-widest text-[#DFFF00]" data-testid="style-label">
                04 — Select Style
              </label>
              <div className="flex flex-wrap gap-2">
                {REGIONS_STYLES[selectedRegion][selectedGender.toLowerCase()].map((style) => (
                  <motion.button
                    key={style}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedStyle(style)}
                    className={`px-4 py-2 rounded-full border transition-all text-xs font-medium ${
                      selectedStyle === style
                        ? 'bg-[#DFFF00] text-black border-[#DFFF00]'
                        : 'bg-transparent text-white border-[#27272A] hover:border-[#DFFF00]'
                    }`}
                    data-testid={`style-${style.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {style}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Generate Button */}
          {selectedGender && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTransform}
              disabled={!uploadedImage || !selectedRegion || !selectedStyle || isGenerating}
              className="w-full h-16 bg-[#DFFF00] text-black rounded-xl font-bold text-lg font-syne tracking-tight hover:bg-[#EFFF50] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              data-testid="transform-button"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-6 h-6" />
                  </motion.div>
                  TRANSFORMING...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  TRANSFORM REALITY
                </>
              )}
            </motion.button>
          )}
        </motion.div>

        {/* Right Canvas - Before/After */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-8 bg-[#030304] flex items-center justify-center p-6"
        >
          <div className="w-full h-full flex items-center justify-center">
            {!uploadedImage && !transformedImage ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center space-y-4"
                data-testid="empty-state"
              >
                <div className="w-24 h-24 mx-auto rounded-full bg-[#18181B] flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-[#DFFF00]" />
                </div>
                <h2 className="text-2xl font-bold font-syne text-[#A1A1AA]">
                  Ready to Transform?
                </h2>
                <p className="text-sm text-[#A1A1AA] max-w-md mx-auto">
                  Select your gender, upload a photo, choose a region and style, then watch the magic happen.
                </p>
              </motion.div>
            ) : (
              <div className="w-full h-full max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                  {/* Before Image */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-[#27272A]"></div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#A1A1AA]" data-testid="before-label">
                        Before
                      </span>
                      <div className="h-px flex-1 bg-[#27272A]"></div>
                    </div>
                    <div className="relative w-full aspect-[3/4] bg-[#0E0E10] rounded-2xl overflow-hidden border border-[#27272A]">
                      {uploadedImage && (
                        <img
                          src={uploadedImage}
                          alt="Original"
                          className="w-full h-full object-cover"
                          data-testid="before-image"
                        />
                      )}
                    </div>
                  </div>

                  {/* After Image */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-[#27272A]"></div>
                      <span className="text-xs font-mono uppercase tracking-widest text-[#DFFF00]" data-testid="after-label">
                        After
                      </span>
                      <div className="h-px flex-1 bg-[#27272A]"></div>
                    </div>
                    <div className="relative w-full aspect-[3/4] bg-[#0E0E10] rounded-2xl overflow-hidden border-2 border-[#DFFF00] neon-glow">
                      {transformedImage ? (
                        <>
                          <img
                            src={transformedImage}
                            alt="Transformed"
                            className="w-full h-full object-cover"
                            data-testid="after-image"
                          />
                          <div className="absolute bottom-4 right-4 flex gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={handleDownload}
                              className="p-3 bg-[#DFFF00] text-black rounded-full hover:bg-[#EFFF50] transition-colors"
                              data-testid="download-button"
                            >
                              <Download className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={handleTransform}
                              className="p-3 bg-[#18181B] text-white border border-[#27272A] rounded-full hover:border-[#DFFF00] transition-colors"
                              data-testid="regenerate-button"
                            >
                              <RefreshCw className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" data-testid="waiting-state">
                          <div className="text-center space-y-2">
                            <ChevronRight className="w-8 h-8 text-[#A1A1AA] mx-auto" />
                            <p className="text-sm text-[#A1A1AA]">Waiting for transformation...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;
