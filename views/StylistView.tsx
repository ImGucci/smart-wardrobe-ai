import React, { useState } from 'react';
import { ClothingItem, UserProfile, OutfitRecommendation, ClothingCategory, SavedOutfit } from '../types';
import { generateOutfitAdvice, generateTryOnVisual, extractErrorDetails } from '../services/geminiService';
import { Header } from '../components/Header';
import { SparklesIcon, ArrowPathIcon, BookmarkIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/solid';

interface StylistViewProps {
  items: ClothingItem[];
  userProfile: UserProfile;
  history: SavedOutfit[];
  onSaveToHistory: (outfit: SavedOutfit) => void;
  onDeleteHistory: (id: string) => void;
}

export const StylistView: React.FC<StylistViewProps> = ({ 
  items, 
  userProfile, 
  history, 
  onSaveToHistory, 
  onDeleteHistory 
}) => {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  
  // Generator State
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<OutfitRecommendation | null>(null);
  const [generatingVisual, setGeneratingVisual] = useState(false);
  
  // Detailed Error State
  const [visualError, setVisualError] = useState<{ message: string; details?: string } | null>(null);

  const handleGetAdvice = async () => {
    if (!context.trim()) return;
    
    const tops = items.filter(i => i.category === ClothingCategory.TOP);
    const bottoms = items.filter(i => i.category === ClothingCategory.BOTTOM);
    
    if (tops.length === 0 || bottoms.length === 0) {
      alert("Please add at least one top and one bottom to your closet first!");
      return;
    }

    setLoading(true);
    setRecommendation(null);
    setVisualError(null);
    
    try {
      // 1. Get Text Advice
      const rec = await generateOutfitAdvice(tops, bottoms, context, userProfile);
      
      console.log("AI Recommended IDs:", rec.topId, rec.bottomId);
      setRecommendation(rec);
      
      // 2. Generate Visual
      setGeneratingVisual(true);

      const top = tops.find(t => String(t.id) === String(rec.topId));
      const bottom = bottoms.find(b => String(b.id) === String(rec.bottomId));
      
      if (top && bottom) {
        try {
            const visualDataUrl = await generateTryOnVisual(top, bottom, userProfile, rec.styleName);
            if (visualDataUrl) {
                setRecommendation(prev => prev ? { ...prev, generatedVisual: visualDataUrl } : null);
            }
        } catch (visError) {
            console.error("--- VISUAL GENERATION ERROR CAUGHT ---", visError);
            const { message, rateLimitInfo } = extractErrorDetails(visError);
            setVisualError({ message, details: rateLimitInfo });
        }
      } else {
          setVisualError({ 
              message: "Matching items not found in inventory.", 
              details: "The AI selected items that couldn't be matched to your closet. Please try again."
          });
      }
    } catch (error) {
      console.error("Stylist error:", error);
      alert("Failed to get advice: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setLoading(false);
      setGeneratingVisual(false);
    }
  };

  const handleSave = () => {
    if (recommendation) {
      const newSaved: SavedOutfit = {
        ...recommendation,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      onSaveToHistory(newSaved);
      setActiveTab('HISTORY');
      setRecommendation(null);
      setContext('');
      setVisualError(null);
    }
  };

  const getRecommendedItem = (id: string) => {
      return items.find(i => String(i.id) === String(id));
  };

  const renderRecommendation = (rec: OutfitRecommendation, isHistoryItem = false, historyId?: string, timestamp?: number) => {
    const topItem = getRecommendedItem(rec.topId);
    const bottomItem = getRecommendedItem(rec.bottomId);

    const renderVisualArea = () => {
      if (rec.generatedVisual) {
        // Handle both full Data URIs (new behavior) and legacy raw base64 (old behavior)
        const src = rec.generatedVisual.startsWith('data:') 
            ? rec.generatedVisual 
            : `data:image/jpeg;base64,${rec.generatedVisual}`;

        return (
          <img 
            src={src} 
            alt="Generated Look" 
            className="w-full h-full object-contain bg-gray-50"
          />
        );
      }

      if (isHistoryItem) {
        return (
           <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-6 text-center">
             <p className="text-gray-400 text-sm">No visual saved</p>
           </div>
        );
      }

      if (generatingVisual) {
         return (
            <div className="absolute inset-0 flex items-center justify-center flex-col p-6 text-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                <p className="text-indigo-600 font-medium text-sm">Generating visual...</p>
                <p className="text-indigo-400 text-xs mt-1">This may take a moment</p>
            </div>
         );
      }

      if (visualError) {
         return (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-red-50">
                <div className="w-full">
                    <p className="text-red-600 font-bold text-xs uppercase mb-2">Generation Failed</p>
                    <p className="text-red-800 text-sm font-medium break-words leading-snug">
                        {visualError.message}
                    </p>
                    {visualError.details && (
                        <div className="mt-3 pt-2 border-t border-red-200">
                            <span className="text-[10px] text-red-500 font-mono bg-red-100 px-2 py-1 rounded inline-block">
                                {visualError.details}
                            </span>
                        </div>
                    )}
                </div>
            </div>
         );
      }

      return (
         <div className="absolute inset-0 flex items-center justify-center flex-col p-6 text-center">
             <p className="text-gray-400 text-sm">Visual unavailable</p>
         </div>
      );
    };

    return (
      <div className={`bg-white rounded-2xl shadow-lg overflow-hidden border border-indigo-100 ${isHistoryItem ? 'mb-6' : ''}`}>
        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
          <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">
             {isHistoryItem && timestamp ? new Date(timestamp).toLocaleDateString() : 'AI Visualization'}
          </span>
          <span className="text-xs text-indigo-400">
             {isHistoryItem ? new Date(timestamp!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Outfit Match'}
          </span>
        </div>
        
        <div className="aspect-[3/4] bg-gray-100 relative group">
          {renderVisualArea()}
        </div>
        
        <div className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-900">{rec.styleName}</h3>
            {isHistoryItem && historyId ? (
                <button 
                    onClick={() => onDeleteHistory(historyId)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            ) : (
                <button 
                  onClick={handleSave}
                  className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 text-xs font-bold uppercase tracking-wide bg-indigo-50 px-3 py-1.5 rounded-full"
                >
                  <BookmarkIcon className="w-4 h-4" /> Save
                </button>
            )}
          </div>
          
          <p className="text-gray-600 text-sm leading-relaxed mb-4">{rec.reasoning}</p>
          
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3">
             {[
               { label: 'TOP', item: topItem }, 
               { label: 'BOTTOM', item: bottomItem }
             ].map((part, idx) => (
                <div key={idx} className="flex items-center gap-2 overflow-hidden">
                    {part.item ? (
                        <>
                           <img src={`data:image/jpeg;base64,${part.item.image}`} className="w-8 h-8 rounded bg-white object-cover shrink-0 border border-gray-200" alt="" />
                           <div className="min-w-0">
                               <p className="text-[10px] font-bold text-gray-400">{part.label}</p>
                               <p className="text-xs text-gray-800 truncate">{part.item.tags.color} {part.item.tags.type}</p>
                           </div>
                        </>
                    ) : (
                        <span className="text-xs text-red-400 italic">Item deleted</span>
                    )}
                </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <Header title="AI Stylist" subtitle="Get personalized outfit advice" />
      
      <div className="px-6 py-2">
         <div className="bg-white p-1 rounded-xl flex shadow-sm border border-gray-100">
            <button 
                onClick={() => setActiveTab('NEW')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'NEW' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                New Style
            </button>
            <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === 'HISTORY' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
            >
                History
            </button>
         </div>
      </div>
      
      <div className="px-6 py-4 space-y-6">
        {activeTab === 'NEW' && (
            <>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Where are you going?</label>
                <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g. A casual coffee date on a rainy afternoon..."
                    className="w-full p-3 bg-gray-50 rounded-xl border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none h-24"
                />
                <button
                    onClick={handleGetAdvice}
                    disabled={loading || !context.trim()}
                    className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                    {loading ? 'Styling...' : 'Generate Outfit'}
                </button>
                </div>
                {recommendation && <div className="animate-fade-in">{renderRecommendation(recommendation)}</div>}
            </>
        )}

        {activeTab === 'HISTORY' && (
            <div className="animate-fade-in">
                {history.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ClockIcon className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No saved looks yet.</p>
                        <p className="text-gray-400 text-sm mt-1">Generate a style and save it!</p>
                    </div>
                ) : (
                    <div>{history.map((item) => <div key={item.id}>{renderRecommendation(item, true, item.id, item.timestamp)}</div>)}</div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};