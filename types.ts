export enum ClothingCategory {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  SHOES = 'SHOES', // Optional extension
}

export interface ClothingItem {
  id: string;
  image: string; // Base64
  category: ClothingCategory;
  tags: {
    color?: string;
    type?: string; // e.g., T-shirt, Jeans
    style?: string; // e.g., Casual, Formal
    season?: string;
  };
  createdAt: number;
}

export interface UserProfile {
  name: string;
  height: string; // e.g., "175cm"
  weight: string; // e.g., "70kg"
  gender: string;
  skinTone: string;
  avatarImage?: string; // Base64
}

export interface OutfitRecommendation {
  topId: string;
  bottomId: string;
  reasoning: string;
  styleName: string;
  generatedVisual?: string; // Base64 of AI generated look
}

export interface SavedOutfit extends OutfitRecommendation {
  id: string;
  timestamp: number;
}

export enum AppView {
  WARDROBE = 'WARDROBE',
  ADD_ITEM = 'ADD_ITEM',
  STYLIST = 'STYLIST',
  PROFILE = 'PROFILE',
}