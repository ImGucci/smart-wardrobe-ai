# Smart Wardrobe AI - 完整架构与技术文档

> 本文档详细描述了 Smart Wardrobe AI 项目的完整架构、数据结构和实现流程，旨在为使用 Kotlin 实现 Android 原生版本提供完整的技术规范。

## 📋 目录

1. [整体架构](#整体架构)
2. [数据模型详解](#数据模型详解)
3. [数据存储流程](#数据存储流程)
4. [添加衣物流程](#添加衣物流程)
5. [AI搭配推荐流程](#ai搭配推荐流程)
6. [API 接口规范](#api-接口规范)
7. [数据流图](#数据流图)
8. [状态管理](#状态管理)
9. [错误处理](#错误处理)
10. [Android 实现指南](#android-实现指南)

---

## 🏗️ 整体架构

### 核心组件

1. **主应用组件 (App.tsx)**
   - 管理全局状态（衣橱、用户资料、历史记录）
   - 处理路由和视图切换
   - 监听状态变化并自动持久化

2. **存储服务 (StorageService)**
   - 基于 IndexedDB 的本地持久化
   - 提供衣橱、用户资料、历史记录的 CRUD 操作
   - 自动处理数据序列化和反序列化

3. **AI 服务 (GeminiService)**
   - 衣物分析：调用 Gemini 2.0 Flash 进行图片分析
   - 搭配推荐：基于场景和用户资料生成搭配建议
   - 可视化生成：本地 Canvas 合成或 AI 生成图片

4. **图片处理服务 (ImageProcessor)**
   - 背景移除：使用 @imgly/background-removal
   - 图片裁剪和优化

### 技术栈

- **前端框架**: React + TypeScript
- **状态管理**: React Hooks (useState, useEffect)
- **本地存储**: IndexedDB
- **AI 服务**: OpenRouter API (Gemini 2.0 Flash / Gemini 3 Pro Image Preview)
- **图片处理**: Canvas API, @imgly/background-removal

---

## 📊 数据模型详解

### 1. ClothingItem（衣物项）

完整的衣物数据结构，包含基础信息和详细的 AI 分析结果。

```typescript
interface ClothingItem {
  id: string;                    // 唯一标识符，使用时间戳生成 (Date.now().toString())
  image: string;                 // Base64 编码的图片数据（不含 data:image 前缀）
  category: ClothingCategory;    // 分类：'TOP' | 'BOTTOM' | 'SHOES'
  tags: ClothingTags;            // 详细的标签信息（见下方详解）
  createdAt: number;             // 创建时间戳（毫秒）
}

enum ClothingCategory {
  TOP = 'TOP',      // 上装
  BOTTOM = 'BOTTOM', // 下装
  SHOES = 'SHOES'    // 鞋子（可选扩展）
}
```

### 2. ClothingTags（衣物标签）

**这是核心数据结构**，包含基础字段（向后兼容）和详细的 AI 分析字段。

```typescript
interface ClothingTags {
  // ========== 基础信息（向后兼容字段）==========
  color?: string;        // 主颜色（与 dominant_color 相同，用于向后兼容）
  type?: string;         // 类型（与 sub_category 相同，如: "T-shirt", "Jeans"）
  style?: string;        // 主要风格（从 style_tags 中提取的第一个）
  season?: string;       // 季节（根据 warmth 推断：薄/透气->夏季、常规->春秋、厚/保暖->冬季）

  // ========== 详细分析信息（AI 生成）==========
  
  // 基本信息
  name?: string;                    // 简洁的描述性名称，如: "炭灰色圆领T恤"
  sub_category?: string;            // 具体品类，使用中文：
                                    // 上装: "T恤", "衬衫", "卫衣", "毛衣", "夹克", "西装" 等
                                    // 下装: "牛仔裤", "休闲裤", "西裤", "短裤", "裙子" 等
  
  // 保暖和季节信息
  warmth?: string;                  // 保暖程度，三选一：
                                    // - "薄/透气" (适合夏季)
                                    // - "常规" (适合春秋)
                                    // - "厚/保暖" (适合冬季)
  
  // 结构细节（上装）
  neckline?: string;                // 领型，使用中文：
                                    // "圆领", "V领", "衬衫翻领", "连帽", "高领", "一字领" 等
                                    // 下装填 "无"
  
  closure?: string;                 // 闭合方式，使用中文：
                                    // 上装: "套头", "单排扣", "双排扣", "全拉链", "半拉链" 等
                                    // 下装: "松紧腰", "拉链+纽扣", "系带" 等
  
  // 颜色信息（精细化处理）
  dominant_color?: string;          // 视觉主色调，使用中文：
                                    // "炭灰色", "藏青色", "米白色", "卡其色", "深蓝色" 等
                                    // 注意：忽略纽扣、拉链、细小缝线、Logo 等细节颜色
  
  color_palette?: string[];         // 辅助配色数组，仅包含显著的拼色或条纹色
                                    // 最多 2 个元素，纯色衣物可留空数组 []
                                    // 阈值：颜色占据面积 >15% 或形成明显拼色/条纹
                                    // 示例: ["白色", "黑色"] (条纹T恤)
  
  pattern?: string;                 // 图案类型，使用中文：
                                    // "纯色", "条纹", "格纹", "印花", "拼色", "肌理感"
  
  // 版型信息
  fit?: string;                     // 版型，使用中文：
                                    // "修身", "常规", "宽松/Oversize"
  
  // 正式度评分（1-5分）
  formality?: number;               // 正式度评分，整数 1-5：
                                    // 1 = 非常休闲（如运动T恤）
                                    // 2 = 休闲（如圆领T恤）
                                    // 3 = 半正式（如Polo衫）
                                    // 4 = 正式（如衬衫）
                                    // 5 = 非常正式（如西装）
  
  formality_reasoning?: string;     // 正式度判断理由，一句话说明：
                                    // 基于领型、材质和整体整洁度分析
                                    // 示例: "衬衫翻领和整洁的版型使其适合半正式场合"
  
  // 风格标签
  style_tags?: string[];            // 风格关键词数组，2-3 个元素，使用中文：
                                    // "日系", "极简", "复古", "街头", "商务", "休闲", "运动" 等
}
```

### 3. UserProfile（用户资料）

```typescript
interface UserProfile {
  name: string;           // 用户姓名
  height: string;         // 身高，格式: "175cm"
  weight: string;         // 体重，格式: "70kg"
  gender: string;         // 性别: "Male" | "Female" | "Other"
  skinTone: string;       // 肤色描述，如: "浅色", "中等", "深色"
  avatarImage?: string;   // 用户头像（Base64，可选）
}
```

### 4. OutfitRecommendation（搭配推荐）

```typescript
interface OutfitRecommendation {
  topId: string;                    // 推荐的上装 ID
  bottomId: string;                 // 推荐的下装 ID
  reasoning: string;                // 详细的搭配理由（中文，100-200字）
                                    // 说明颜色、风格、正式度、场合适配等方面
  styleName: string;                // 搭配风格名称（2-4个字）
                                    // 如: "商务休闲", "日系简约", "街头潮流"
  generatedVisual?: string;         // 生成的可视化图片（Base64 Data URL 或纯 Base64）
                                    // 格式: "data:image/jpeg;base64,{base64}" 或纯 base64 字符串
}
```

### 5. SavedOutfit（保存的搭配）

```typescript
interface SavedOutfit extends OutfitRecommendation {
  id: string;            // 唯一标识符
  timestamp: number;     // 保存时间戳（毫秒）
}
```

---

## 💾 数据存储流程

### 1. 数据库结构（IndexedDB）

**数据库名称**: `SmartWardrobeDB`  
**版本**: `1`

```javascript
数据库: SmartWardrobeDB
  ├── wardrobe (objectStore)
  │   ├── keyPath: 'id' (string)
  │   └── 存储: ClothingItem[]
  │
  ├── profile (objectStore)
  │   ├── keyPath: 'id' (固定为 'main')
  │   └── 存储: { id: 'main', ...UserProfile }
  │
  └── history (objectStore)
      ├── keyPath: 'id' (string)
      └── 存储: SavedOutfit[]
```

### 2. 应用启动时加载数据

**流程**:
```
App.tsx (useEffect on mount)
  ↓
并行加载:
  ├─ StorageService.getWardrobe()  → IndexedDB (wardrobe store)
  ├─ StorageService.getProfile()   → IndexedDB (profile store)
  └─ StorageService.getHistory()   → IndexedDB (history store)
  ↓
设置状态:
  ├─ setCloset(closet)
  ├─ setProfile(profile)
  └─ setHistory(history)
```

**代码位置**: `App.tsx:28-47`

**Android 实现要点**:
- 使用 Room Database 或 DataStore 替代 IndexedDB
- 在 Application 类或 MainActivity 的 onCreate 中初始化数据库
- 使用 Kotlin Coroutines 进行异步加载

### 3. 数据持久化（自动保存）

**流程**:
```
状态变化 (closet/profile/history)
  ↓
useEffect 监听变化（React）或 StateFlow 观察（Android）
  ↓
自动触发保存:
  ├─ StorageService.saveWardrobe(closet)  → IndexedDB
  ├─ StorageService.saveProfile(profile)  → IndexedDB
  └─ StorageService.saveHistory(history)  → IndexedDB
```

**代码位置**: `App.tsx:52-62`

**Android 实现要点**:
- 使用 StateFlow 或 LiveData 观察状态变化
- 在 ViewModel 中实现自动保存逻辑
- 使用 Kotlin Coroutines 的 `debounce` 避免频繁保存

### 4. 存储服务 API

#### getWardrobe(): Promise<ClothingItem[]>
- 从 IndexedDB 读取所有衣物
- 返回空数组 `[]` 如果数据库为空或出错

#### saveWardrobe(items: ClothingItem[]): Promise<void>
- 清空现有数据，保存新的衣物列表
- 使用事务确保原子性

#### getProfile(defaultProfile: UserProfile): Promise<UserProfile>
- 读取用户资料
- 如果不存在，返回默认资料

#### saveProfile(profile: UserProfile): Promise<void>
- 保存用户资料（id 固定为 'main'）

#### getHistory(): Promise<SavedOutfit[]>
- 读取所有历史搭配
- 按时间戳降序排序

#### saveHistory(history: SavedOutfit[]): Promise<void>
- 清空现有数据，保存新的历史列表

---

## 📸 添加衣物流程

### 完整流程图

```
[用户操作] 选择/拍摄图片
    ↓
[AddItemView] handleFileChange()
    ↓
[FileReader] 读取文件 → Base64 编码
    ↓
设置 image 状态，触发 analyze()
    ↓
┌─────────────────────────────────────┐
│ 【步骤1】AI 分析图片                 │
└─────────────────────────────────────┘
    ↓
analyzeClothingItem(base64)
    ↓
[GeminiService] 构建 API 请求
    ↓
[OpenRouter API] POST /api/v1/chat/completions
    ├─ Model: "google/gemini-2.0-flash-001"
    ├─ Messages: [用户消息 + 图片]
    └─ 图片格式: "data:image/jpeg;base64,{base64}"
    ↓
[AI 响应] 返回 JSON 字符串
    ↓
解析 JSON，验证和规范化数据:
    ├─ formality 转换为数字 (1-5)
    ├─ color_palette 确保是数组
    ├─ style_tags 确保是数组
    └─ 设置 category (TOP/BOTTOM)
    ↓
更新 UI: 显示分析结果，自动设置 category
    ↓
┌─────────────────────────────────────┐
│ 【步骤2】可选：背景移除              │
└─────────────────────────────────────┘
    ↓
用户点击 "Remove BG" 按钮
    ↓
removeImageBackground(base64)
    ↓
[ImageProcessor] @imgly/background-removal
    ↓
返回: 透明背景的 PNG (Base64)
    ↓
更新 image 状态
    ↓
┌─────────────────────────────────────┐
│ 【步骤3】用户确认并保存              │
└─────────────────────────────────────┘
    ↓
用户点击 "Save to Closet"
    ↓
handleSave()
    ↓
再次调用 analyzeClothingItem(image) 获取最终标签
    ↓
创建 ClothingItem 对象:
    {
      id: Date.now().toString(),
      image: base64,
      category: TOP/BOTTOM,
      tags: { ...分析结果 },
      createdAt: Date.now()
    }
    ↓
onAdd(newItem) → App.handleAddItem()
    ↓
setCloset([newItem, ...prevCloset])
    ↓
useEffect 监听变化 → StorageService.saveWardrobe()
    ↓
[IndexedDB] 持久化存储
```

### AI 分析 API 详细说明

#### 请求格式

**端点**: `https://openrouter.ai/api/v1/chat/completions`  
**方法**: `POST`  
**Headers**:
```json
{
  "Authorization": "Bearer {API_KEY}",
  "Content-Type": "application/json",
  "HTTP-Referer": "https://smartwardrobe.app",
  "X-Title": "Smart Wardrobe AI"
}
```

**请求体**:
```json
{
  "model": "google/gemini-2.0-flash-001",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "{详细的 Prompt 文本，见下方}"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,{base64Image}"
          }
        }
      ]
    }
  ]
}
```

#### AI Prompt 模板

```
你是一位 AI 时尚专家。你的任务是分析一张单品衣物的图片，并将其视觉特征转化为结构化的 JSON 数据。

关键准则（请严格遵守）：

1. 术语专业性：使用标准的中文时尚术语。

2. 颜色降噪处理 (至关重要)：
   - dominant_color：占据面积最大、决定整体基调的单一颜色。
   - color_palette：仅提取能影响搭配决策的次要颜色。
   - 忽略规则：绝对忽略纽扣、拉链、细小的缝线、微小的 Logo 以及光影造成的色差。
   - 阈值：只有当某种颜色占据显著面积（>15%）或形成明显的拼色/条纹时才记录。

3. 结构细节：重点识别领型和闭合方式。

4. 输出格式：仅输出 JSON 代码块，不要包含任何其他文字说明。

请返回以下 JSON 结构（category 字段使用 'TOP' 或 'BOTTOM'，其他字段使用中文）：

{
  "category": "TOP 或 BOTTOM",
  "name": "简洁的描述性名称",
  "sub_category": "具体品类，如: T恤、衬衫、卫衣、牛仔裤、休闲裤等",
  "warmth": "薄/透气 或 常规 或 厚/保暖",
  "neckline": "领型，如: 圆领、V领、衬衫翻领、连帽等。下装填 无",
  "closure": "闭合方式，如: 套头、单排扣、全拉链、松紧腰等",
  "dominant_color": "视觉主色调，如: 炭灰色、藏青色",
  "color_palette": ["辅助配色数组，仅包含显著的拼色或条纹色，最多2个，纯色衣物可留空"],
  "pattern": "纯色 或 条纹 或 格纹 或 印花 或 拼色 或 肌理感",
  "fit": "修身 或 常规 或 宽松/Oversize",
  "formality_reasoning": "一句话简述判断理由，基于领型、材质和整体整洁度分析正式度",
  "formality": 3,
  "style_tags": ["风格关键词数组，2到3个，如: 日系、极简、复古、街头、商务"],
  "color": "与 dominant_color 相同",
  "type": "与 sub_category 相同",
  "style": "从 style_tags 中提取主要风格",
  "season": "根据 warmth 推断：薄/透气->夏季、常规->春秋、厚/保暖->冬季"
}

注意：formality 必须是 1 到 5 之间的数字，不要加引号。
```

#### AI 响应处理

**响应格式**:
```json
{
  "choices": [
    {
      "message": {
        "content": "{JSON 字符串，可能包含 markdown 代码块}"
      }
    }
  ]
}
```

**解析步骤**:
1. 提取 `choices[0].message.content`
2. 移除可能的 markdown 代码块标记（```json ... ```）
3. 解析 JSON 字符串
4. 数据验证和规范化：
   ```typescript
   // formality 转换为数字并限制在 1-5
   if (result.formality !== undefined) {
     result.formality = parseInt(result.formality, 10);
     if (isNaN(result.formality) || result.formality < 1) result.formality = 1;
     if (result.formality > 5) result.formality = 5;
   }
   
   // color_palette 确保是数组
   if (result.color_palette && !Array.isArray(result.color_palette)) {
     result.color_palette = [];
   }
   
   // style_tags 确保是数组
   if (result.style_tags && !Array.isArray(result.style_tags)) {
     result.style_tags = typeof result.style_tags === 'string' 
       ? [result.style_tags] 
       : [];
   }
   ```

#### 返回数据结构

```typescript
{
  // 基础字段（向后兼容）
  color: string;           // 主颜色
  type: string;            // 类型
  style: string;           // 主要风格
  season: string;          // 季节
  category?: string;       // 'TOP' 或 'BOTTOM'
  
  // 详细分析字段
  name?: string;
  sub_category?: string;
  warmth?: string;
  neckline?: string;
  closure?: string;
  dominant_color?: string;
  color_palette?: string[];
  pattern?: string;
  fit?: string;
  formality_reasoning?: string;
  formality?: number;      // 1-5
  style_tags?: string[];
}
```

### 背景移除流程

**功能**: 可选功能，移除图片背景，生成透明背景的 PNG

**实现**:
- 使用 `@imgly/background-removal` 库
- 输入: Base64 编码的图片
- 输出: Base64 编码的 PNG（透明背景）

**Android 实现要点**:
- 使用 ML Kit 的 Selfie Segmentation 或第三方库（如 Remove.bg API）
- 或使用 TensorFlow Lite 模型进行本地背景移除

---

## 🎨 AI搭配推荐流程

### 完整流程图

```
[用户操作] 在 StylistView 输入场景描述
    ↓
用户点击 "Generate Outfit" 按钮
    ↓
handleGetAdvice()
    ↓
┌─────────────────────────────────────┐
│ 【步骤1】筛选衣物                    │
└─────────────────────────────────────┘
    ↓
tops = items.filter(category === 'TOP')
bottoms = items.filter(category === 'BOTTOM')
    ↓
验证: 至少需要 1 件上装和 1 件下装
    ↓
┌─────────────────────────────────────┐
│ 【步骤2】调用 AI 推荐                │
└─────────────────────────────────────┘
    ↓
generateOutfitAdvice(tops, bottoms, context, userProfile)
    ↓
构建详细的库存描述（使用 buildItemDetails）:
    {
      id: string,
      name: string,
      sub_category: string,
      dominant_color: string,
      color_palette: string[],
      pattern: string,
      neckline: string,
      closure: string,
      fit: string,
      warmth: string,
      formality: number,
      formality_reasoning: string,
      style_tags: string[],
      // 向后兼容字段
      color: string,
      type: string,
      style: string
    }
    ↓
构建 AI Prompt（包含用户信息、场景、库存）
    ↓
[OpenRouter API] POST /api/v1/chat/completions
    ├─ Model: "google/gemini-2.0-flash-001"
    └─ Messages: [搭配推荐 Prompt]
    ↓
[AI 响应] 返回 JSON:
    {
      "topId": "1234567890",
      "bottomId": "1234567891",
      "reasoning": "详细的搭配理由...",
      "styleName": "商务休闲"
    }
    ↓
解析并验证响应
    ↓
setRecommendation(rec)
    ↓
┌─────────────────────────────────────┐
│ 【步骤3】生成可视化                  │
└─────────────────────────────────────┘
    ↓
根据 topId 和 bottomId 查找对应的 ClothingItem
    ↓
generateTryOnVisual(top, bottom, userProfile, styleName)
    ↓
[本地 Canvas 合成] 或 [AI 生成]
    ↓
返回: Base64 Data URL
    ↓
setRecommendation({ ...prev, generatedVisual })
    ↓
┌─────────────────────────────────────┐
│ 【步骤4】前端显示                    │
└─────────────────────────────────────┘
    ↓
renderRecommendation(recommendation)
    ↓
显示:
    - 可视化图片
    - 风格名称 (styleName)
    - 推荐理由 (reasoning)
    - 单品信息（上装/下装缩略图）
    ↓
用户点击 "Save" 按钮
    ↓
handleSave()
    ↓
创建 SavedOutfit:
    {
      ...recommendation,
      id: Date.now().toString(),
      timestamp: Date.now()
    }
    ↓
onSaveToHistory() → App.handleSaveToHistory()
    ↓
setHistory([newOutfit, ...prevHistory])
    ↓
useEffect 触发 → StorageService.saveHistory()
    ↓
[IndexedDB] 持久化存储
```

### AI 搭配推荐 API 详细说明

#### 构建库存描述

**函数**: `buildItemDetails(item: ClothingItem)`

将 ClothingItem 转换为 AI 可理解的详细描述：

```typescript
{
  id: item.id,
  // 基础信息
  name: tags.name || tags.type || 'Unknown',
  sub_category: tags.sub_category || tags.type,
  
  // 颜色信息（使用详细分析）
  dominant_color: tags.dominant_color || tags.color,
  color_palette: tags.color_palette || [],
  pattern: tags.pattern || '纯色',
  
  // 结构信息
  neckline: tags.neckline,
  closure: tags.closure,
  fit: tags.fit,
  warmth: tags.warmth,
  
  // 风格信息
  formality: tags.formality,
  formality_reasoning: tags.formality_reasoning,
  style_tags: tags.style_tags || (tags.style ? [tags.style] : []),
  
  // 向后兼容字段
  color: tags.color || tags.dominant_color,
  type: tags.type || tags.sub_category,
  style: tags.style || (tags.style_tags?.[0] || 'Casual'),
}
```

#### AI Prompt 模板

```
你是一位专业的时尚搭配师。请根据用户的场景需求和衣橱库存，推荐最合适的搭配组合。

用户信息：
- 性别: {userProfile.gender}
- 身高: {userProfile.height}
- 体重: {userProfile.weight}
- 肤色: {userProfile.skinTone}

场景需求：
"{context}"

衣橱库存：
{inventoryDescription}  // JSON.stringify({ tops: [...], bottoms: [...] }, null, 2)

搭配原则：
1. 考虑正式度匹配：上装和下装的 formality 评分应该协调（差距不超过2分）
2. 颜色搭配：dominant_color 和 color_palette 要和谐，避免冲突
3. 风格统一：style_tags 应该有一定的重叠或互补
4. 场合适配：根据场景需求选择合适的 formality 和 style_tags
5. 季节适宜：考虑 warmth 是否适合当前场景
6. 版型协调：fit 要协调，避免过于极端

请仔细分析每件衣物的详细特征，选择最合适的搭配组合。

返回格式（仅返回 JSON，不要包含其他文字）：
{
  "topId": "选中的上装ID",
  "bottomId": "选中的下装ID",
  "reasoning": "详细的搭配理由，说明为什么选择这个组合，包括颜色、风格、正式度、场合适配等方面的分析（中文，100-200字）",
  "styleName": "这个搭配的风格名称（如：'商务休闲', '日系简约', '街头潮流'等，2-4个字）"
}
```

#### AI 响应处理

**响应格式**:
```json
{
  "topId": "1234567890",  // 字符串或数字，需要转换为字符串
  "bottomId": "1234567891",
  "reasoning": "炭灰色圆领T恤与深蓝色牛仔裤的搭配...",
  "styleName": "商务休闲"
}
```

**处理步骤**:
```typescript
const rawObj = parseJSON(responseText);
return {
  topId: String(rawObj.topId),      // 确保是字符串
  bottomId: String(rawObj.bottomId),
  reasoning: rawObj.reasoning,
  styleName: rawObj.styleName
};
```

### 可视化生成

#### 方法1: 本地 Canvas 合成（当前实现）

**流程**:
```
1. 加载两张图片（top.image, bottom.image）
   - 图片格式: Base64，需要添加 data:image/png;base64, 前缀
   
2. 检测并裁剪空白区域
   - 使用 getImageBounds() 检测非透明区域
   - 使用 cropImageToBounds() 裁剪
   
3. 计算显示尺寸
   - 保持宽高比
   - 上装显示在上半部分
   - 下装显示在下半部分
   
4. 绘制到 Canvas
   - 创建 Canvas (宽: 800px, 高: 1200px)
   - 白色背景
   - 绘制上装和下装
   
5. 返回 Base64 Data URL
   - canvas.toDataURL('image/jpeg', 0.9)
```

**Android 实现要点**:
- 使用 `Bitmap` 和 `Canvas` API
- 使用 `BitmapFactory.decodeByteArray()` 解码 Base64
- 使用 `Canvas.drawBitmap()` 绘制
- 使用 `Bitmap.compress()` 转换为 JPEG

#### 方法2: AI 生成（可选）

使用 Gemini 3 Pro Image Preview 生成数字人试穿效果（当前代码中已实现但未默认使用）。

---

## 🔌 API 接口规范

### OpenRouter API 配置

**基础 URL**: `https://openrouter.ai/api/v1/chat/completions`

**认证**:
- Header: `Authorization: Bearer {API_KEY}`
- 需要设置 `HTTP-Referer` 和 `X-Title` headers

**支持的模型**:
- 文本生成: `google/gemini-2.0-flash-001`
- 图片生成: `google/gemini-3-pro-image-preview`

### 通用请求格式

```typescript
interface APIRequest {
  model: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: Array<{
      type: "text" | "image_url";
      text?: string;
      image_url?: {
        url: string;  // "data:image/jpeg;base64,{base64}"
      };
    }>;
  }>;
}
```

### 通用响应格式

```typescript
interface APIResponse {
  choices: Array<{
    message: {
      content: string;  // JSON 字符串或文本
    };
  }>;
  error?: {
    message: string;
    type: string;
  };
}
```

### 错误处理

**常见错误**:
- `401`: API Key 无效
- `429`: 请求频率限制
- `503`: 服务暂时不可用

**重试机制**:
- 对于 429 和 503 错误，自动重试
- 初始延迟: 2 秒
- 最大重试次数: 1 次
- 延迟递增: 每次翻倍

---

## 📊 数据流图

### 添加衣物数据流

```
[用户] 上传图片
    ↓
[AddItemView] handleFileChange()
    ↓
[FileReader] base64 编码
    ↓
[GeminiService] analyzeClothingItem()
    ↓
[OpenRouter API] Gemini 2.0 Flash
    ↓
[AI] 返回详细标签 JSON
    ├─ 基础字段: color, type, style, season
    └─ 详细字段: name, sub_category, warmth, neckline, 
                 closure, dominant_color, color_palette,
                 pattern, fit, formality, formality_reasoning,
                 style_tags
    ↓
[AddItemView] 数据验证和规范化
    ├─ formality 转换为数字 (1-5)
    ├─ color_palette 确保是数组
    └─ style_tags 确保是数组
    ↓
[AddItemView] 设置 category (TOP/BOTTOM)
    ↓
[ImageProcessor] 可选：背景移除
    ↓
[AddItemView] 创建 ClothingItem
    ↓
[App] handleAddItem() → setCloset()
    ↓
[useEffect] 监听变化
    ↓
[StorageService] saveWardrobe()
    ↓
[IndexedDB] 持久化存储
```

### 搭配推荐数据流

```
[用户] 输入场景描述
    ↓
[StylistView] handleGetAdvice()
    ↓
[StylistView] 筛选 tops/bottoms
    ↓
[GeminiService] generateOutfitAdvice()
    ↓
构建详细库存描述（使用 buildItemDetails）
    ↓
[OpenRouter API] Gemini 2.0 Flash
    ↓
[AI] 返回推荐 JSON
    {
      topId: string,
      bottomId: string,
      reasoning: string,
      styleName: string
    }
    ↓
[StylistView] setRecommendation()
    ↓
[GeminiService] generateTryOnVisual()
    ↓
[Canvas] 本地合成图片
    ├─ 加载 top.image 和 bottom.image
    ├─ 检测边界并裁剪
    ├─ 计算显示尺寸
    ├─ 绘制到 Canvas
    └─ 返回 base64 Data URL
    ↓
[StylistView] 更新 recommendation.generatedVisual
    ↓
[StylistView] renderRecommendation()
    ↓
[前端] 显示推荐结果
    ↓
[用户] 点击保存
    ↓
[StylistView] handleSave()
    ↓
[App] handleSaveToHistory()
    ↓
[App] setHistory()
    ↓
[StorageService] saveHistory()
    ↓
[IndexedDB] 持久化存储
```

---

## 🔄 状态管理

### React 实现（当前）

**全局状态** (App.tsx):
```typescript
const [closet, setCloset] = useState<ClothingItem[]>([]);
const [profile, setProfile] = useState<UserProfile>({...});
const [history, setHistory] = useState<SavedOutfit[]>([]);
```

**状态传递**:
```
App.tsx
  ├── WardrobeView: items={closet}
  ├── AddItemView: onAdd={handleAddItem}
  ├── StylistView: 
  │     ├── items={closet}
  │     ├── userProfile={profile}
  │     ├── history={history}
  │     └── onSaveToHistory={handleSaveToHistory}
  └── ProfileView: profile={profile}, onUpdate={setProfile}
```

**自动持久化**:
```typescript
useEffect(() => {
  StorageService.saveWardrobe(closet);
}, [closet]);

useEffect(() => {
  StorageService.saveProfile(profile);
}, [profile]);

useEffect(() => {
  StorageService.saveHistory(history);
}, [history]);
```

### Android 实现建议

**架构**: MVVM (Model-View-ViewModel)

**ViewModel**:
```kotlin
class MainViewModel : ViewModel() {
    private val _closet = MutableStateFlow<List<ClothingItem>>(emptyList())
    val closet: StateFlow<List<ClothingItem>> = _closet.asStateFlow()
    
    private val _profile = MutableStateFlow<UserProfile>(UserProfile())
    val profile: StateFlow<UserProfile> = _profile.asStateFlow()
    
    private val _history = MutableStateFlow<List<SavedOutfit>>(emptyList())
    val history: StateFlow<List<SavedOutfit>> = _history.asStateFlow()
    
    init {
        viewModelScope.launch {
            loadData()
            observeChanges()
        }
    }
    
    private suspend fun loadData() {
        _closet.value = repository.getWardrobe()
        _profile.value = repository.getProfile()
        _history.value = repository.getHistory()
    }
    
    private fun observeChanges() {
        viewModelScope.launch {
            closet
                .debounce(500) // 防抖，避免频繁保存
                .collect { repository.saveWardrobe(it) }
        }
        // ... 类似处理 profile 和 history
    }
}
```

**Repository**:
```kotlin
class WardrobeRepository(private val dao: ClothingItemDao) {
    suspend fun getWardrobe(): List<ClothingItem> = dao.getAll()
    suspend fun saveWardrobe(items: List<ClothingItem>) = dao.replaceAll(items)
}
```

---

## ⚠️ 错误处理

### AI API 错误

**网络错误**:
- 显示友好的错误消息
- 提供重试按钮

**解析错误**:
- 记录原始响应到日志
- 显示 "AI 响应格式错误，请重试"

**验证错误**:
- 自动修复常见问题（如 formality 超出范围）
- 使用默认值填充缺失字段

### 存储错误

**IndexedDB 错误**:
- 记录错误日志
- 显示警告但不阻塞用户操作
- 提供手动保存选项

**Android 实现**:
- 使用 try-catch 包装数据库操作
- 使用 Result 类型封装成功/失败状态
- 在 UI 层显示错误提示

### 图片处理错误

**背景移除失败**:
- 显示警告消息
- 使用原始图片继续流程

**图片加载失败**:
- 显示占位图
- 提供重新上传选项

---

## 📱 Android 实现指南

### 1. 项目结构

```
app/
├── data/
│   ├── model/
│   │   ├── ClothingItem.kt
│   │   ├── UserProfile.kt
│   │   ├── OutfitRecommendation.kt
│   │   └── SavedOutfit.kt
│   ├── database/
│   │   ├── AppDatabase.kt
│   │   ├── ClothingItemDao.kt
│   │   ├── UserProfileDao.kt
│   │   └── SavedOutfitDao.kt
│   └── repository/
│       ├── WardrobeRepository.kt
│       └── ProfileRepository.kt
├── domain/
│   ├── service/
│   │   ├── GeminiService.kt
│   │   └── ImageProcessor.kt
│   └── usecase/
│       ├── AnalyzeClothingUseCase.kt
│       └── GenerateOutfitUseCase.kt
├── ui/
│   ├── viewmodel/
│   │   ├── MainViewModel.kt
│   │   ├── AddItemViewModel.kt
│   │   └── StylistViewModel.kt
│   ├── screen/
│   │   ├── WardrobeScreen.kt
│   │   ├── AddItemScreen.kt
│   │   ├── StylistScreen.kt
│   │   └── ProfileScreen.kt
│   └── component/
│       ├── ClothingItemCard.kt
│       └── OutfitCard.kt
└── MainActivity.kt
```

### 2. 数据模型 (Kotlin)

```kotlin
// ClothingItem.kt
data class ClothingItem(
    val id: String,
    val image: String, // Base64
    val category: ClothingCategory,
    val tags: ClothingTags,
    val createdAt: Long
)

enum class ClothingCategory {
    TOP, BOTTOM, SHOES
}

data class ClothingTags(
    // 基础字段
    val color: String? = null,
    val type: String? = null,
    val style: String? = null,
    val season: String? = null,
    
    // 详细字段
    val name: String? = null,
    val subCategory: String? = null,
    val warmth: String? = null,
    val neckline: String? = null,
    val closure: String? = null,
    val dominantColor: String? = null,
    val colorPalette: List<String> = emptyList(),
    val pattern: String? = null,
    val fit: String? = null,
    val formalityReasoning: String? = null,
    val formality: Int? = null, // 1-5
    val styleTags: List<String> = emptyList()
)

// UserProfile.kt
data class UserProfile(
    val name: String = "",
    val height: String = "",
    val weight: String = "",
    val gender: String = "",
    val skinTone: String = "",
    val avatarImage: String? = null
)

// OutfitRecommendation.kt
data class OutfitRecommendation(
    val topId: String,
    val bottomId: String,
    val reasoning: String,
    val styleName: String,
    val generatedVisual: String? = null
)

// SavedOutfit.kt
data class SavedOutfit(
    val id: String,
    val topId: String,
    val bottomId: String,
    val reasoning: String,
    val styleName: String,
    val generatedVisual: String? = null,
    val timestamp: Long
)
```

### 3. Room Database 配置

```kotlin
// AppDatabase.kt
@Database(
    entities = [
        ClothingItemEntity::class,
        UserProfileEntity::class,
        SavedOutfitEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun clothingItemDao(): ClothingItemDao
    abstract fun userProfileDao(): UserProfileDao
    abstract fun savedOutfitDao(): SavedOutfitDao
}

// ClothingItemEntity.kt
@Entity(tableName = "wardrobe")
data class ClothingItemEntity(
    @PrimaryKey val id: String,
    val image: String,
    val category: String,
    val tagsJson: String, // JSON 序列化的 ClothingTags
    val createdAt: Long
)

// TypeConverter
class Converters {
    @TypeConverter
    fun fromClothingTags(tags: ClothingTags): String {
        return Gson().toJson(tags)
    }
    
    @TypeConverter
    fun toClothingTags(json: String): ClothingTags {
        return Gson().fromJson(json, ClothingTags::class.java)
    }
}
```

### 4. API 服务实现

```kotlin
// GeminiService.kt
class GeminiService {
    private val apiKey = BuildConfig.API_KEY
    private val baseUrl = "https://openrouter.ai/api/v1/chat/completions"
    
    suspend fun analyzeClothingItem(base64Image: String): Result<ClothingAnalysisResult> {
        return withContext(Dispatchers.IO) {
            try {
                val request = buildAnalyzeRequest(base64Image)
                val response = httpClient.post(baseUrl) {
                    headers {
                        append("Authorization", "Bearer $apiKey")
                        append("Content-Type", "application/json")
                        append("HTTP-Referer", "https://smartwardrobe.app")
                        append("X-Title", "Smart Wardrobe AI")
                    }
                    setBody(request)
                }
                
                val result = parseAnalysisResponse(response.bodyAsText())
                Result.success(result)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    private fun buildAnalyzeRequest(base64Image: String): String {
        // 构建请求 JSON
    }
    
    private fun parseAnalysisResponse(responseText: String): ClothingAnalysisResult {
        // 解析响应，移除 markdown 代码块
        // 验证和规范化数据
    }
}
```

### 5. 图片处理

```kotlin
// ImageProcessor.kt
class ImageProcessor {
    suspend fun removeBackground(base64Image: String): Result<String> {
        return withContext(Dispatchers.Default) {
            try {
                // 使用 ML Kit 或第三方库
                // 返回透明背景的 PNG Base64
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    fun generateTryOnVisual(
        top: ClothingItem,
        bottom: ClothingItem,
        userProfile: UserProfile,
        styleName: String
    ): String {
        // 使用 Bitmap 和 Canvas API 合成图片
        val topBitmap = decodeBase64ToBitmap(top.image)
        val bottomBitmap = decodeBase64ToBitmap(bottom.image)
        
        val canvas = Canvas(combinedBitmap)
        // 绘制逻辑...
        
        return bitmapToBase64(combinedBitmap)
    }
}
```

### 6. 关键实现要点

**Base64 处理**:
- Android 使用 `Base64` 类进行编解码
- 注意图片格式：JPEG 使用 `data:image/jpeg;base64,`，PNG 使用 `data:image/png;base64,`

**异步操作**:
- 使用 Kotlin Coroutines
- API 调用使用 `suspend` 函数
- UI 更新使用 `viewModelScope.launch`

**数据持久化**:
- 使用 Room Database
- 使用 `StateFlow` 观察数据变化
- 使用 `debounce` 避免频繁保存

**错误处理**:
- 使用 `Result<T>` 类型封装成功/失败
- 在 ViewModel 中处理错误
- 在 UI 层显示友好的错误消息

**图片处理**:
- 使用 `BitmapFactory` 解码 Base64
- 使用 `Canvas` 和 `Bitmap` 进行图片合成
- 注意内存管理，及时回收 Bitmap

---

## 📝 总结

### 核心特性

1. **精细的衣物分析**: 使用详细的 JSON 数据结构，包含 15+ 个分析字段
2. **智能搭配推荐**: 基于正式度、颜色、风格、场合等多维度分析
3. **本地数据持久化**: 使用 IndexedDB (Web) 或 Room Database (Android)
4. **可视化展示**: 本地 Canvas 合成或 AI 生成试穿效果

### 关键技术点

1. **AI Prompt 工程**: 详细的 Prompt 设计确保 AI 返回结构化数据
2. **数据验证**: 严格的类型检查和数据规范化
3. **错误处理**: 完善的错误处理和重试机制
4. **性能优化**: 防抖保存、异步处理、图片优化

### Android 实现注意事项

1. **数据模型映射**: 注意 JSON 字段名到 Kotlin 属性名的映射（snake_case vs camelCase）
2. **Base64 处理**: Android 的 Base64 类与 JavaScript 的 btoa/atob 略有不同
3. **图片处理**: 使用 Android 原生 API 替代 Canvas API
4. **网络请求**: 使用 Retrofit 或 Ktor Client 替代 fetch API
5. **依赖注入**: 考虑使用 Hilt 或 Koin 进行依赖管理

---

**文档版本**: 2.0  
**最后更新**: 2024  
**维护者**: Smart Wardrobe AI Team
