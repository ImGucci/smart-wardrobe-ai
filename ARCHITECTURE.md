# Smart Wardrobe AI - 架构与数据流说明

## 📋 目录
1. [整体架构](#整体架构)
2. [数据存储流程](#数据存储流程)
3. [添加衣物流程](#添加衣物流程)
4. [AI搭配推荐流程](#ai搭配推荐流程)
5. [数据流图](#数据流图)

---

## 🏗️ 整体架构

### 核心组件
- **App.tsx**: 主应用组件，管理全局状态和路由
- **StorageService**: IndexedDB 存储服务
- **GeminiService**: AI 服务（OpenRouter + Gemini 2.0）
- **ImageProcessor**: 图片处理服务（背景移除）

### 数据模型
```typescript
ClothingItem {
  id: string
  image: string (base64)
  category: 'TOP' | 'BOTTOM' | 'SHOES'
  tags: { color, type, style, season }
  createdAt: number
}

UserProfile {
  name, height, weight, gender, skinTone
}

OutfitRecommendation {
  topId, bottomId, reasoning, styleName
  generatedVisual?: string (base64)
}
```

---

## 💾 数据存储流程

### 1. 应用启动时加载数据

```
App.tsx (useEffect)
  ↓
StorageService.getWardrobe()  → IndexedDB (wardrobe store)
StorageService.getProfile()   → IndexedDB (profile store)
StorageService.getHistory()   → IndexedDB (history store)
  ↓
setCloset(closet)
setProfile(profile)
setHistory(history)
```

**代码位置**: `App.tsx:28-47`

### 2. 数据持久化（自动保存）

```
状态变化 (closet/profile/history)
  ↓
useEffect 监听变化
  ↓
StorageService.saveWardrobe(closet)  → IndexedDB
StorageService.saveProfile(profile)  → IndexedDB
StorageService.saveHistory(history)  → IndexedDB
```

**代码位置**: `App.tsx:52-62`

### 3. IndexedDB 结构

```javascript
数据库: SmartWardrobeDB
  ├── wardrobe (objectStore)
  │   └── keyPath: 'id'
  ├── profile (objectStore)
  │   └── keyPath: 'id' (固定为 'main')
  └── history (objectStore)
      └── keyPath: 'id'
```

**代码位置**: `services/storage.ts:3-35`

---

## 📸 添加衣物流程

### 完整流程

```
用户上传图片
  ↓
AddItemView.handleFileChange()
  ↓
FileReader → base64 编码
  ↓
【步骤1】AI 分析图片
  analyzeClothingItem(base64)
    ↓
  GeminiService.analyzeClothingItem()
    ↓
  OpenRouter API (Gemini 2.0 Flash)
    ↓
  返回: { color, type, category, style, season }
    ↓
  自动设置 category (TOP/BOTTOM)
  ↓
【步骤2】可选：背景移除
  removeImageBackground(base64)
    ↓
  ImageProcessor (@imgly/background-removal)
    ↓
  返回: 透明背景的 PNG (base64)
  ↓
【步骤3】用户确认并保存
  handleSave()
    ↓
  再次调用 analyzeClothingItem() 确认标签
    ↓
  创建 ClothingItem 对象
    ↓
  onAdd(newItem) → App.handleAddItem()
    ↓
  setCloset([item, ...prev])
    ↓
  useEffect 触发 → StorageService.saveWardrobe()
    ↓
  IndexedDB 持久化
```

**关键文件**:
- `views/AddItemView.tsx:23-122`
- `services/geminiService.ts:135-170` (analyzeClothingItem)
- `services/imageProcessor.ts` (removeImageBackground)

### AI 分析输入输出

**输入**:
```javascript
{
  role: "user",
  content: [
    {
      type: "text",
      text: "Analyze this clothing item. Return a valid JSON object..."
    },
    {
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,{base64Image}" }
    }
  ]
}
```

**输出**:
```json
{
  "color": "Blue",
  "type": "T-shirt",
  "category": "TOP",
  "style": "Casual",
  "season": "Summer"
}
```

---

## 🎨 AI搭配推荐流程

### 完整流程

```
用户在 StylistView 输入场景描述
  ↓
handleGetAdvice()
  ↓
【步骤1】筛选衣物
  tops = items.filter(category === 'TOP')
  bottoms = items.filter(category === 'BOTTOM')
  ↓
【步骤2】调用 AI 推荐
  generateOutfitAdvice(tops, bottoms, context, userProfile)
    ↓
  GeminiService.generateOutfitAdvice()
    ↓
  构建 Prompt:
    - 用户信息: gender, height
    - 场景: context
    - 库存: JSON.stringify({ tops, bottoms })
    ↓
  OpenRouter API (Gemini 2.0 Flash)
    ↓
  返回 JSON:
    {
      topId: "1234567890",
      bottomId: "1234567891",
      reasoning: "This combination...",
      styleName: "Casual Chic"
    }
    ↓
  setRecommendation(rec)
  ↓
【步骤3】生成可视化
  generateTryOnVisual(top, bottom, userProfile, styleName)
    ↓
  GeminiService.generateTryOnVisual()
    ↓
  本地 Canvas 合成:
    1. 加载两张图片 (top.image, bottom.image)
    2. 检测并裁剪空白区域 (getImageBounds)
    3. 计算显示尺寸 (保持宽高比)
    4. 绘制到 Canvas (白色背景)
    5. 返回 base64 Data URL
    ↓
  setRecommendation({ ...prev, generatedVisual })
  ↓
【步骤4】前端显示
  renderRecommendation(recommendation)
    ↓
  显示:
    - 可视化图片 (generatedVisual)
    - 风格名称 (styleName)
    - 推荐理由 (reasoning)
    - 单品信息 (top/bottom 缩略图)
```

**关键文件**:
- `views/StylistView.tsx:33-85` (handleGetAdvice)
- `services/geminiService.ts:173-213` (generateOutfitAdvice)
- `services/geminiService.ts:335-434` (generateTryOnVisual)

### AI 推荐输入输出

**输入 Prompt**:
```
Act as a stylist. User: Female, 170cm.
Occasion: "A casual coffee date on a rainy afternoon..."
Inventory: {
  "tops": [
    { "id": "123", "color": "Blue", "type": "T-shirt", "style": "Casual" },
    ...
  ],
  "bottoms": [
    { "id": "456", "color": "Black", "type": "Jeans", "style": "Casual" },
    ...
  ]
}
Select 1 Top and 1 Bottom by exact ID.
Return valid JSON (no markdown) with keys: topId, bottomId, reasoning, styleName.
```

**输出 JSON**:
```json
{
  "topId": "123",
  "bottomId": "456",
  "reasoning": "The blue T-shirt pairs perfectly with black jeans...",
  "styleName": "Casual Coffee Date"
}
```

---

## 📊 数据流图

### 添加衣物数据流

```
[用户] 上传图片
    ↓
[AddItemView] 接收文件
    ↓
[FileReader] base64 编码
    ↓
[GeminiService] analyzeClothingItem()
    ↓
[OpenRouter API] Gemini 2.0 Flash
    ↓
[AI] 返回标签 {color, type, category, style, season}
    ↓
[AddItemView] 设置 category
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
[OpenRouter API] Gemini 2.0 Flash
    ↓
[AI] 返回推荐 {topId, bottomId, reasoning, styleName}
    ↓
[StylistView] setRecommendation()
    ↓
[GeminiService] generateTryOnVisual()
    ↓
[Canvas] 本地合成图片
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

### App.tsx 全局状态

```typescript
const [closet, setCloset] = useState<ClothingItem[]>([]);      // 衣橱
const [profile, setProfile] = useState<UserProfile>(...);      // 用户资料
const [history, setHistory] = useState<SavedOutfit[]>([]);     // 历史搭配
```

### 状态传递

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

---

## 🎯 关键交互点

### 1. 衣橱数据 → AI 输入

**位置**: `views/StylistView.tsx:36-37, 180-183`

```typescript
// 筛选分类
const tops = items.filter(i => i.category === ClothingCategory.TOP);
const bottoms = items.filter(i => i.category === ClothingCategory.BOTTOM);

// 构建 AI 输入
const inventoryDescription = JSON.stringify({
  tops: tops.map(t => ({ 
    id: t.id, 
    color: t.tags.color, 
    type: t.tags.type, 
    style: t.tags.style 
  })),
  bottoms: bottoms.map(b => ({ 
    id: b.id, 
    color: b.tags.color, 
    type: b.tags.type, 
    style: b.tags.style 
  }))
});
```

### 2. AI 输出 → 前端显示

**位置**: `views/StylistView.tsx:106-230`

```typescript
// AI 返回推荐
const rec = await generateOutfitAdvice(...);
// { topId, bottomId, reasoning, styleName }

// 查找对应衣物
const topItem = items.find(i => String(i.id) === String(rec.topId));
const bottomItem = items.find(i => String(i.id) === String(rec.bottomId));

// 生成可视化
const visualDataUrl = await generateTryOnVisual(topItem, bottomItem, ...);

// 更新状态
setRecommendation({ ...rec, generatedVisual: visualDataUrl });

// 渲染显示
renderRecommendation(recommendation);
```

### 3. 可视化生成

**位置**: `services/geminiService.ts:335-434`

```typescript
// 1. 加载图片
imgTop.src = `data:image/png;base64,${top.image}`;
imgBottom.src = `data:image/png;base64,${bottom.image}`;

// 2. 检测边界并裁剪空白
const topBounds = getImageBounds(imgTop);
const bottomBounds = getImageBounds(imgBottom);
croppedTop = cropImageToBounds(imgTop, topBounds);
croppedBottom = cropImageToBounds(imgBottom, bottomBounds);

// 3. 计算尺寸并绘制
ctx.drawImage(croppedTop, topX, topY, topDisplayWidth, topDisplayHeight);
ctx.drawImage(croppedBottom, bottomX, bottomY, bottomDisplayWidth, bottomDisplayHeight);

// 4. 返回 base64
return canvas.toDataURL('image/jpeg', 0.9);
```

---

## 📝 总结

1. **存储**: 使用 IndexedDB 在浏览器本地持久化数据
2. **AI 交互**: 通过 OpenRouter 调用 Gemini 2.0 Flash 模型
3. **数据流**: 衣橱数据 → 筛选 → AI Prompt → AI 返回 → 可视化生成 → 前端显示
4. **状态管理**: React useState + useEffect 自动同步到 IndexedDB
5. **可视化**: 本地 Canvas 合成，无需 AI 生成图片


