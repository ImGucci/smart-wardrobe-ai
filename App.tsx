import React, { useState, useEffect } from 'react';
import { AppView, ClothingItem, UserProfile, SavedOutfit } from './types';
import { NavBar } from './components/NavBar';
import { WardrobeView } from './views/WardrobeView';
import { AddItemView } from './views/AddItemView';
import { StylistView } from './views/StylistView';
import { ProfileView } from './views/ProfileView';
import { StorageService } from './services/storage';

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  height: '170cm',
  weight: '65kg',
  gender: 'Female',
  skinTone: 'Medium',
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.WARDROBE);
  const [loading, setLoading] = useState(true);
  
  // State
  const [closet, setCloset] = useState<ClothingItem[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<SavedOutfit[]>([]);

  // Initial Data Load
  useEffect(() => {
    const initData = async () => {
      try {
        const [loadedCloset, loadedProfile, loadedHistory] = await Promise.all([
          StorageService.getWardrobe(),
          StorageService.getProfile(DEFAULT_PROFILE),
          StorageService.getHistory()
        ]);
        
        setCloset(loadedCloset);
        setProfile(loadedProfile);
        setHistory(loadedHistory);
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Persistence Effects
  // We use a small debounce or just save on change. 
  // IndexedDB is async, so we don't want to block UI.
  useEffect(() => {
    if (!loading) StorageService.saveWardrobe(closet);
  }, [closet, loading]);

  useEffect(() => {
    if (!loading) StorageService.saveProfile(profile);
  }, [profile, loading]);

  useEffect(() => {
    if (!loading) StorageService.saveHistory(history);
  }, [history, loading]);

  const handleAddItem = (item: ClothingItem) => {
    setCloset(prev => [item, ...prev]);
    setCurrentView(AppView.WARDROBE);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to remove this item?')) {
        setCloset(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleSaveToHistory = (outfit: SavedOutfit) => {
    setHistory(prev => [outfit, ...prev]);
  };

  const handleDeleteHistory = (id: string) => {
     setHistory(prev => prev.filter(h => h.id !== id));
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.WARDROBE:
        return <WardrobeView items={closet} onDelete={handleDeleteItem} />;
      case AppView.ADD_ITEM:
        return <AddItemView onAdd={handleAddItem} onCancel={() => setCurrentView(AppView.WARDROBE)} />;
      case AppView.STYLIST:
        return (
          <StylistView 
            items={closet} 
            userProfile={profile} 
            history={history}
            onSaveToHistory={handleSaveToHistory}
            onDeleteHistory={handleDeleteHistory}
          />
        );
      case AppView.PROFILE:
        return <ProfileView profile={profile} onUpdate={setProfile} />;
      default:
        return <WardrobeView items={closet} onDelete={handleDeleteItem} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading your wardrobe...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl overflow-hidden relative">
      {renderView()}
      <NavBar currentView={currentView} onChange={setCurrentView} />
    </div>
  );
};

export default App;