import React, { useState, useRef } from 'react';
import { ClothingItem, ClothingCategory } from '../types';
import { analyzeClothingItem } from '../services/geminiService';
import { removeImageBackground } from '../services/imageProcessor';
import { Header } from '../components/Header';
import { CameraIcon, PhotoIcon, CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon } from '@heroicons/react/24/solid';

interface AddItemViewProps {
  onAdd: (item: ClothingItem) => void;
  onCancel: () => void;
}

export const AddItemView: React.FC<AddItemViewProps> = ({ onAdd, onCancel }) => {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [removingBg, setRemovingBg] = useState(false);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [category, setCategory] = useState<ClothingCategory>(ClothingCategory.TOP);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImage(base64);
        setBgRemoved(false); 
        setWarning(null);
        analyze(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyze = async (base64: string) => {
    setAnalyzing(true);
    setError(null);
    try {
        const tags = await analyzeClothingItem(base64);
        console.log("AI Analysis Result:", tags); 

        if (tags.category === 'BOTTOM') {
            setCategory(ClothingCategory.BOTTOM);
        } else if (tags.category === 'TOP') {
            setCategory(ClothingCategory.TOP);
        } else {
            const typeLower = (tags.type || '').toLowerCase();
            const bottomKeywords = [
                'pants', 'jeans', 'skirt', 'shorts', 'trousers', 
                'leggings', 'joggers', 'sweatpants', 'slacks', 'chinos', 'bottom'
            ];
            if (bottomKeywords.some(keyword => typeLower.includes(keyword))) {
                setCategory(ClothingCategory.BOTTOM);
            } else {
                setCategory(ClothingCategory.TOP);
            }
        }
    } catch (e: any) {
        console.error("Analyze error:", e);
        setError("Could not auto-detect tags. Please select category manually.");
    } finally {
        setAnalyzing(false);
    }
  };

  const handleRemoveBackground = async () => {
      if (!image) return;
      setRemovingBg(true);
      setWarning(null);
      try {
          const originalSize = image.length;
          const newBase64 = await removeImageBackground(image);
          
          // Soft Check: If exact same string returned, it means soft-fail occurred
          if (newBase64 === image) {
             setWarning("Offline Mode: Background removal unavailable. Using original image.");
          } else {
             setImage(newBase64);
             setBgRemoved(true);
          }
      } catch (e: any) {
          console.error("Bg removal critical error:", e);
          setWarning("Could not remove background. Using original.");
      } finally {
          setRemovingBg(false);
      }
  };

  const handleSave = async () => {
    if (!image) return;
    
    setAnalyzing(true);
    try {
        // Default tags
        let finalTags = { color: 'Unknown', type: 'Clothing', style: 'Casual', season: 'All' };
        
        try {
             // Quick re-analyze to confirm tags on the final image
             const freshTags = await analyzeClothingItem(image);
             finalTags = freshTags;
        } catch (innerError) {
             console.warn("Final tag check failed, using defaults.");
        }

        const newItem: ClothingItem = {
            id: Date.now().toString(),
            image: image,
            category, 
            tags: finalTags,
            createdAt: Date.now(),
        };

        onAdd(newItem);
    } catch (e: any) {
        setError("Save failed: " + e.message);
    } finally {
        setAnalyzing(false);
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-white">
      <Header title="Add New Item" />
      
      <div className="px-6 py-6">
        <div 
          onClick={() => !image && fileInputRef.current?.click()}
          className={`relative w-full aspect-[3/4] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all ${
            image ? 'border-transparent bg-gray-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer'
          } ${error ? 'border-red-300 bg-red-50' : ''}`}
        >
          {image ? (
            <>
                <img 
                src={`data:image/png;base64,${image}`} 
                className="w-full h-full object-contain p-4" 
                alt="Preview"
                />
                
                {/* Remove Background Button */}
                {!bgRemoved && !removingBg && !analyzing && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveBackground();
                        }}
                        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-indigo-600 px-4 py-2 rounded-full shadow-lg text-xs font-bold flex items-center gap-2 border border-indigo-100 hover:bg-indigo-50 transition-all z-10"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        Remove BG
                    </button>
                )}
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setImage(null);
                        setBgRemoved(false);
                        setError(null);
                        setWarning(null);
                    }}
                    className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-sm transition-all z-10"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                </button>
            </>
          ) : (
            <div className="text-center p-6">
              <div className="bg-indigo-50 text-indigo-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CameraIcon className="w-8 h-8" />
              </div>
              <p className="text-gray-900 font-semibold mb-1">Take a photo</p>
              <p className="text-gray-400 text-sm">or upload from gallery</p>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange}
          />
          
          {(analyzing || removingBg) && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col text-white z-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-3"></div>
              <p className="font-medium text-sm">
                  {removingBg ? 'Removing Background...' : 'Analyzing Item...'}
              </p>
              {removingBg && <p className="text-xs text-white/70 mt-1">This might take a moment</p>}
            </div>
          )}
          
          {/* Messages */}
          {error && !analyzing && image && (
            <div className="absolute inset-x-0 bottom-0 bg-red-100/95 backdrop-blur-sm p-3 text-center">
                <div className="flex items-center justify-center gap-2 text-red-600 font-bold mb-1">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    <span className="text-sm">Detection Issue</span>
                </div>
                <p className="text-red-800 text-[10px]">{error}</p>
            </div>
          )}

           {warning && !analyzing && image && (
            <div className="absolute inset-x-0 bottom-0 bg-amber-100/95 backdrop-blur-sm p-3 text-center z-10">
                <p className="text-amber-800 text-xs font-semibold">{warning}</p>
            </div>
          )}
        </div>

        {image && (
          <div className="mt-8 animate-fade-in">
            <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Category {error && <span className="text-red-500 text-xs font-normal">(Required)</span>}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setCategory(ClothingCategory.TOP)}
                className={`py-3 rounded-xl border font-medium transition-all ${
                  category === ClothingCategory.TOP 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Top
              </button>
              <button
                onClick={() => setCategory(ClothingCategory.BOTTOM)}
                className={`py-3 rounded-xl border font-medium transition-all ${
                  category === ClothingCategory.BOTTOM 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Bottom
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={analyzing || removingBg}
              className="w-full mt-8 bg-black text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircleIcon className="w-6 h-6" />
              Save to Closet
            </button>
          </div>
        )}
      </div>
    </div>
  );
};