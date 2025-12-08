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
    // 基础信息（向后兼容）
    color?: string;
    type?: string; // e.g., T-shirt, Jeans
    style?: string; // e.g., Casual, Formal
    season?: string;
    
    // 详细分析信息
    name?: string; // 简洁的描述性名称
    sub_category?: string; // 具体品类 (如: T恤, 衬衫, 卫衣, 牛仔裤, 休闲裤等)
    warmth?: string; // '薄/透气', '常规', '厚/保暖'
    neckline?: string; // 领型 (如: '圆领', 'V领', '衬衫翻领', '连帽'等)
    closure?: string; // 闭合方式 (如: '套头', '单排扣', '全拉链', '松紧腰'等)
    dominant_color?: string; // 视觉主色调 (如: '炭灰色', '藏青色')
    color_palette?: string[]; // 辅助配色数组
    pattern?: string; // '纯色', '条纹', '格纹', '印花', '拼色', '肌理感'
    fit?: string; // '修身', '常规', '宽松/Oversize'
    formality_reasoning?: string; // 正式度判断理由
    formality?: number; // 1-5 分的正式度评分
    style_tags?: string[]; // 风格关键词数组
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