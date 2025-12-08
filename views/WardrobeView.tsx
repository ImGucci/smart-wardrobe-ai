import React, { useState } from 'react';
import { ClothingItem, ClothingCategory } from '../types';
import { Header } from '../components/Header';
import { TrashIcon } from '@heroicons/react/24/outline';

interface WardrobeViewProps {
  items: ClothingItem[];
  onDelete: (id: string) => void;
}

export const WardrobeView: React.FC<WardrobeViewProps> = ({ items, onDelete }) => {
  const [filter, setFilter] = useState<ClothingCategory | 'ALL'>('ALL');

  const filteredItems = items.filter((item) => filter === 'ALL' || item.category === filter);

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <Header title="My Closet" subtitle={`${items.length} items total`} />
      
      {/* Filter Tabs */}
      <div className="px-6 py-4 flex gap-3 overflow-x-auto no-scrollbar">
        {['ALL', ClothingCategory.TOP, ClothingCategory.BOTTOM].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as any)}
            className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === cat
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {cat === 'ALL' ? 'All Items' : cat === 'TOP' ? 'Tops' : 'Bottoms'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="px-6 grid grid-cols-2 gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="relative group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 aspect-[3/4]">
            <img 
              src={`data:image/jpeg;base64,${item.image}`} 
              alt={item.tags.type} 
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <p className="text-white text-xs font-semibold">
                {item.tags.dominant_color || item.tags.color} {item.tags.sub_category || item.tags.type}
              </p>
              <p className="text-white/80 text-[10px]">
                {item.tags.style_tags?.join(' · ') || item.tags.style || 'Casual'}
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="absolute top-2 right-2 bg-white/20 hover:bg-red-500 p-1.5 rounded-full text-white backdrop-blur-sm transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            
            {/* Mobile friendly caption always visible if not hovering (optional, keeping minimal for now) */}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
             </div>
             <p className="text-gray-500 font-medium">No clothes found.</p>
             <p className="text-gray-400 text-sm mt-1">Tap the + button to add some items!</p>
          </div>
        )}
      </div>
    </div>
  );
};
