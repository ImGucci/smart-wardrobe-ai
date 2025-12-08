# API 配置说明

本项目支持两种 API 提供商：**OpenRouter** 和 **ZenMux**。你可以通过环境变量配置选择使用哪个提供商。

## 环境变量配置

### 必需的环境变量

#### 使用 OpenRouter（默认）

```bash
API_PROVIDER=openrouter
API_KEY=sk-or-v1-xxxxxxxxxxxxx  # OpenRouter API Key
```

#### 使用 ZenMux

```bash
API_PROVIDER=zenmux
API_KEY=sk-or-v1-xxxxxxxxxxxxx  # OpenRouter API Key (用于文本生成)
ZENMUX_API_KEY=your-zenmux-api-key  # ZenMux API Key (用于图片生成)
```

## 功能对比

| 功能 | OpenRouter | ZenMux |
|------|-----------|--------|
| 衣物分析 (analyzeClothingItem) | ✅ 支持 | ✅ 支持 |
| 搭配推荐 (generateOutfitAdvice) | ✅ 支持 | ✅ 支持 |
| 可视化生成 | 📷 本地 Canvas 合成（平铺展示） | 🤖 AI 数字人生成（真人试穿效果） |

## 在 Vercel 中配置

1. 登录 Vercel 控制台
2. 进入项目 → **Settings** → **Environment Variables**
3. 添加以下环境变量：

### OpenRouter 配置
```
API_PROVIDER = openrouter
API_KEY = sk-or-v1-xxxxxxxxxxxxx
```

### ZenMux 配置（推荐用于数字人生成）
```
API_PROVIDER = zenmux
API_KEY = sk-or-v1-xxxxxxxxxxxxx
ZENMUX_API_KEY = your-zenmux-api-key
```

4. 选择适用的环境（Production、Preview、Development）
5. 保存并重新部署

## 数字人生成功能

当 `API_PROVIDER=zenmux` 时，系统会使用 **Gemini 3 Pro Image Preview** 模型生成数字人试穿效果。

### 数字人生成特点

- ✅ 使用用户 Profile 中的头像（如果已上传）
- ✅ 根据用户的身高、体重、性别、肤色生成匹配的数字人
- ✅ 真实试穿效果，而非简单的平铺展示
- ✅ 高质量、逼真的图片生成

### 数字人生成流程

1. 用户输入场景描述
2. AI 推荐搭配（上衣 + 下装）
3. 系统自动生成数字人试穿效果：
   - 读取用户 Profile（头像、身高、体重、性别、肤色）
   - 读取推荐的上衣和下装图片
   - 调用 ZenMux API 使用 `gemini-3-pro-image-preview` 模型
   - 生成穿着该搭配的数字人形象

## 本地开发配置

在项目根目录创建 `.env.local` 文件：

```bash
# .env.local
API_PROVIDER=zenmux
API_KEY=sk-or-v1-xxxxxxxxxxxxx
ZENMUX_API_KEY=your-zenmux-api-key
```

或者在 `vite.config.ts` 中配置的 `api_key.txt` 文件中放置 API Key（仅用于 OpenRouter）。

## 模型说明

### OpenRouter
- **文本模型**: `google/gemini-2.0-flash-001`
- **图片生成**: 不支持（使用本地 Canvas 合成）

### ZenMux
- **文本模型**: `google/gemini-2.0-flash-001`（用于分析和推荐）
- **图片模型**: `google/gemini-3-pro-image-preview`（用于数字人生成）

## 故障排除

### 1. API Key 格式错误

**OpenRouter API Key** 必须以 `sk-or-v1-` 开头。

如果看到错误：
```
Invalid API key format. OpenRouter keys must start with "sk-or-v1-"
```

请检查：
- API Key 是否正确复制
- 是否使用了正确的 OpenRouter API Key

### 2. 数字人生成失败

如果使用 ZenMux 时数字人生成失败，系统会自动回退到本地 Canvas 合成。

检查：
- `ZENMUX_API_KEY` 是否正确设置
- `API_PROVIDER` 是否设置为 `zenmux`
- ZenMux API Key 是否有效且有足够余额

### 3. 环境变量未生效

确保：
- 在 Vercel 中正确设置了环境变量
- 重新部署了应用
- 环境变量名称拼写正确（区分大小写）

## 获取 API Keys

### OpenRouter
1. 访问 https://openrouter.ai/keys
2. 注册/登录账户
3. 创建新的 API Key
4. 复制以 `sk-or-v1-` 开头的 API Key

### ZenMux
1. 访问 https://zenmux.ai
2. 注册/登录账户
3. 获取 API Key
4. 配置到 `ZENMUX_API_KEY` 环境变量

## 注意事项

1. **API Key 安全**: 不要将 API Key 提交到 Git 仓库
2. **成本控制**: ZenMux 的图片生成功能可能产生费用，请注意使用量
3. **性能**: 数字人生成需要较长时间（通常 10-30 秒），请耐心等待
4. **回退机制**: 如果 ZenMux 生成失败，会自动使用本地 Canvas 合成

