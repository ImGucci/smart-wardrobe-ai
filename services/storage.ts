import { ClothingItem, UserProfile, SavedOutfit } from '../types';

const DB_NAME = 'SmartWardrobeDB';
const DB_VERSION = 1;
const STORE_WARDROBE = 'wardrobe';
const STORE_PROFILE = 'profile';
const STORE_HISTORY = 'history';

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_WARDROBE)) {
        db.createObjectStore(STORE_WARDROBE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PROFILE)) {
        db.createObjectStore(STORE_PROFILE, { keyPath: 'id' });
      }
    };
  });
};

export const StorageService = {
  // --- Wardrobe ---
  async saveWardrobe(items: ClothingItem[]) {
    try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_WARDROBE, 'readwrite');
        const store = tx.objectStore(STORE_WARDROBE);
        
        tx.oncomplete = () => {
            console.log(`[Storage] Wardrobe saved (${items.length} items)`);
            resolve();
        };
        tx.onerror = () => {
            console.error("[Storage] Transaction failed", tx.error);
            reject(tx.error);
        };

        // Operations are queued and executed in order
        // Do NOT await inside a transaction callback unless you know what you are doing (microtasks)
        store.clear();
        
        items.forEach(item => {
            store.put(item);
        });
      });
    } catch (e) {
      console.error("Failed to save wardrobe:", e);
    }
  },

  async getWardrobe(): Promise<ClothingItem[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_WARDROBE, 'readonly');
        const store = tx.objectStore(STORE_WARDROBE);
        const request = store.getAll();
        request.onsuccess = () => {
            const result = request.result || [];
            console.log(`[Storage] Wardrobe loaded (${result.length} items)`);
            resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Failed to load wardrobe:", e);
      return [];
    }
  },

  // --- Profile ---
  async saveProfile(profile: UserProfile) {
    try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROFILE, 'readwrite');
        const store = tx.objectStore(STORE_PROFILE);
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        store.put({ id: 'main', ...profile });
      });
    } catch (e) {
      console.error("Failed to save profile:", e);
    }
  },

  async getProfile(defaultProfile: UserProfile): Promise<UserProfile> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_PROFILE, 'readonly');
        const store = tx.objectStore(STORE_PROFILE);
        const request = store.get('main');
        request.onsuccess = () => {
          if (request.result) {
            const { id, ...data } = request.result;
            resolve(data as UserProfile);
          } else {
            resolve(defaultProfile);
          }
        };
        request.onerror = () => resolve(defaultProfile);
      });
    } catch (e) {
      return defaultProfile;
    }
  },

  // --- History ---
  async saveHistory(history: SavedOutfit[]) {
    try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_HISTORY, 'readwrite');
        const store = tx.objectStore(STORE_HISTORY);
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        store.clear();
        history.forEach(item => {
            store.put(item);
        });
      });
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  },

  async getHistory(): Promise<SavedOutfit[]> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_HISTORY, 'readonly');
        const store = tx.objectStore(STORE_HISTORY);
        const request = store.getAll();
        request.onsuccess = () => {
             const res = request.result || [];
             res.sort((a, b) => b.timestamp - a.timestamp);
             resolve(res);
        };
        request.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }
};
