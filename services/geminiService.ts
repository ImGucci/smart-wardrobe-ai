import { ClothingItem, UserProfile } from "../types";

// Configuration for OpenRouter
// Note: process.env.API_KEY is replaced at build time by Vite's define in vite.config.ts
// @ts-ignore - process.env is replaced at build time, so TypeScript doesn't see it
const API_KEY: string | undefined = process.env.API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Using Gemini 2.0 Flash via OpenRouter (good vision support, fast, cheap/free)
const MODEL_NAME = "google/gemini-2.0-flash-001"; 

const SITE_URL = "https://smartwardrobe.app"; 
const APP_TITLE = "Smart Wardrobe AI";

// Helper for generic error extraction
export const extractErrorDetails = (error: any): { message: string, rateLimitInfo?: string } => {
  let message = "Unknown error occurred";
  if (error.message) message = error.message;
  return { message };
};

const callWithRetry = async <T>(operation: () => Promise<T>, retries = 1, baseDelay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status === 503)) {
      await new Promise(resolve => setTimeout(resolve, baseDelay));
      return callWithRetry(operation, retries - 1, baseDelay * 2);
    }
    throw error;
  }
};

/**
 * Helper to call OpenRouter API
 */
const callOpenRouter = async (messages: any[], responseFormat?: 'json_object' | 'text') => {
  if (!API_KEY) {
    console.error("API_KEY is missing or empty. Check Vercel environment variables.");
    throw new Error("API Key is missing. Please check your environment variables in Vercel.");
  }
  
  // Validate API key format
  const apiKeyLength = API_KEY.length;
  const apiKeyPreview = apiKeyLength > 8 
    ? `${API_KEY.substring(0, 4)}...${API_KEY.substring(apiKeyLength - 4)}`
    : '***';
  const apiKeyPrefix = API_KEY.substring(0, Math.min(15, apiKeyLength));
  
  // OpenRouter API keys should start with "sk-or-v1-"
  const isValidFormat = API_KEY.startsWith('sk-or-v1-');
  
  console.log(`[OpenRouter] API key prefix: "${apiKeyPrefix}..."`);
  console.log(`[OpenRouter] API key length: ${apiKeyLength} chars`);
  console.log(`[OpenRouter] Format check: ${isValidFormat ? '✓ Valid (sk-or-v1-...)' : '✗ Invalid (expected sk-or-v1-...)'}`);
  
  if (!isValidFormat) {
    console.error(`[OpenRouter] ❌ API KEY FORMAT ERROR!`);
    console.error(`[OpenRouter] Expected format: "sk-or-v1-..." (OpenRouter API key)`);
    console.error(`[OpenRouter] Actual prefix: "${apiKeyPrefix}..."`);
    console.error(`[OpenRouter] This is NOT a valid OpenRouter API key!`);
    console.error(`[OpenRouter] Please get a valid key from: https://openrouter.ai/keys`);
    throw new Error(`Invalid API key format. OpenRouter keys must start with "sk-or-v1-", but yours starts with "${apiKeyPrefix}". Please get a valid OpenRouter API key from https://openrouter.ai/keys`);
  }
  
  console.log(`[OpenRouter] Using API key: ${apiKeyPreview}`);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL, // Required by OpenRouter (note: this is the correct header name for OpenRouter)
      "X-Title": APP_TITLE,     // Required by OpenRouter
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: messages,
      // OpenRouter/OpenAI compatibility mode often supports this, but Gemini explicitly relies on prompt for JSON usually.
      // We will try to rely on the system prompt for JSON structure.
      // response_format: responseFormat === 'json_object' ? { type: "json_object" } : undefined 
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenRouter API Error:", response.status, errorBody);
    let errorMessage = `API Error (${response.status})`;
    try {
        const errJson = JSON.parse(errorBody);
        if (errJson.error && errJson.error.message) {
            errorMessage = errJson.error.message;
        }
        // Provide more helpful error messages
        if (response.status === 401) {
          const apiKeyPrefix = API_KEY.substring(0, 15);
          let diagnosticInfo = "";
          
          // Double-check format (should have been caught earlier, but just in case)
          if (!API_KEY.startsWith('sk-or-v1-')) {
            diagnosticInfo = "\n\n❌ CRITICAL: Your API key doesn't start with 'sk-or-v1-'. " +
                           `Your key starts with: "${apiKeyPrefix}"\n` +
                           "This is NOT a valid OpenRouter API key!\n" +
                           "You might be using an OpenAI key or another service's key.\n" +
                           "Please get a valid OpenRouter API key from: https://openrouter.ai/keys";
          } else {
            diagnosticInfo = "\n\n⚠️ DIAGNOSIS: Your API key format is correct (sk-or-v1-...), but OpenRouter rejected it.\n" +
                           "Possible reasons:\n" +
                           "1. The API key is invalid or has been revoked\n" +
                           "2. The API key hasn't been activated in your OpenRouter account\n" +
                           "3. Your OpenRouter account might need verification\n" +
                           "4. Check your OpenRouter dashboard: https://openrouter.ai/keys\n" +
                           "5. Make sure you copied the ENTIRE key (should be ~70+ characters)\n" +
                           `   Your key length: ${API_KEY.length} characters\n` +
                           `   Key prefix: "${apiKeyPrefix}"`;
          }
          
          errorMessage = "Invalid API key. " + (errJson.error?.message || "Authentication failed.") + diagnosticInfo;
        }
    } catch(e) {}
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return content;
};

// Helper to clean JSON string (remove markdown code blocks if model adds them)
const parseJSON = (text: string) => {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
};

// 1. Analyze Item
export const analyzeClothingItem = async (base64Image: string): Promise<{ 
  color: string; type: string; style: string; season: string; category?: string; 
}> => {
  return callWithRetry(async () => {
    // OpenRouter Vision format expects a Data URL
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
    
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this clothing item. Return a valid JSON object (no markdown) with exactly these keys: color, type (e.g. T-shirt), category ('TOP', 'BOTTOM', or 'SHOES'), style, season."
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ];

    const responseText = await callOpenRouter(messages);
    if (!responseText) throw new Error("No response from AI");
    
    try {
        return parseJSON(responseText);
    } catch (e) {
        console.error("Failed to parse AI response:", responseText);
        throw new Error("AI response was not valid JSON");
    }
  });
};

// 2. Generate Advice
export const generateOutfitAdvice = async (
  tops: ClothingItem[],
  bottoms: ClothingItem[],
  context: string,
  userProfile: UserProfile
): Promise<{ topId: string; bottomId: string; reasoning: string; styleName: string }> => {
  return callWithRetry(async () => {
    const inventoryDescription = JSON.stringify({
      tops: tops.map(t => ({ id: t.id, color: t.tags.color, type: t.tags.type, style: t.tags.style })),
      bottoms: bottoms.map(b => ({ id: b.id, color: b.tags.color, type: b.tags.type, style: b.tags.style })),
    });

    const prompt = `
      Act as a stylist. User: ${userProfile.gender}, ${userProfile.height}.
      Occasion: "${context}".
      Inventory: ${inventoryDescription}
      Select 1 Top and 1 Bottom by exact ID.
      Return valid JSON (no markdown) with keys: topId, bottomId, reasoning, styleName.
    `;

    const messages = [
        { role: "user", content: prompt }
    ];

    const responseText = await callOpenRouter(messages);
    if (!responseText) throw new Error("No response from AI");
    
    try {
        const rawObj = parseJSON(responseText);
        return {
            topId: String(rawObj.topId),
            bottomId: String(rawObj.bottomId),
            reasoning: rawObj.reasoning,
            styleName: rawObj.styleName
        };
    } catch (e) {
         console.error("Failed to parse AI response:", responseText);
         throw new Error("AI response was not valid JSON");
    }
  });
};

/**
 * 判断像素是否为空白（透明或接近白色）
 */
function isBlankPixel(r: number, g: number, b: number, alpha: number): boolean {
  // 透明像素
  if (alpha < 10) return true;
  // 接近白色的像素（RGB都大于250）
  if (r > 250 && g > 250 && b > 250) return true;
  return false;
}

/**
 * 检测图片的实际内容边界（去除透明/空白区域）
 * 返回裁剪后的边界框 {x, y, width, height}
 * 改进：不仅检测透明像素，还检测接近白色的像素，并且更激进地裁剪
 */
function getImageBounds(img: HTMLImageElement): { x: number; y: number; width: number; height: number } {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return { x: 0, y: 0, width: img.width, height: img.height };

  tempCtx.drawImage(img, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;

  // 扫描所有像素，找到有效内容像素的边界
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const idx = (y * img.width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];
      
      // 如果不是空白像素，记录边界
      if (!isBlankPixel(r, g, b, alpha)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // 如果没找到有效像素，返回整个图片
  if (minX >= maxX || minY >= maxY) {
    return { x: 0, y: 0, width: img.width, height: img.height };
  }

  // 进一步优化：从边缘向内扫描，找到更紧的边界
  // 从上边缘向下扫描，找到第一个有效像素行（从0到minY）
  let actualMinY = minY;
  for (let y = 0; y < Math.min(minY + 100, img.height); y++) {
    let hasContent = false;
    for (let x = 0; x < img.width; x++) {
      const idx = (y * img.width + x) * 4;
      if (!isBlankPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        hasContent = true;
        break;
      }
    }
    if (hasContent) {
      actualMinY = y;
      break;
    }
  }

  // 从下边缘向上扫描，找到最后一个有效像素行（从height-1到maxY）
  let actualMaxY = maxY;
  for (let y = img.height - 1; y >= Math.max(0, maxY - 100); y--) {
    let hasContent = false;
    for (let x = 0; x < img.width; x++) {
      const idx = (y * img.width + x) * 4;
      if (!isBlankPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3])) {
        hasContent = true;
        break;
      }
    }
    if (hasContent) {
      actualMaxY = y;
      break;
    }
  }

  // 不添加边距，直接裁剪到内容边界（最激进）
  return {
    x: minX,
    y: actualMinY,
    width: maxX - minX + 1,
    height: actualMaxY - actualMinY + 1
  };
}

/**
 * 裁剪图片到实际内容区域
 */
function cropImageToBounds(img: HTMLImageElement, bounds: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(
    img,
    bounds.x, bounds.y, bounds.width, bounds.height,
    0, 0, bounds.width, bounds.height
  );
  return canvas;
}

// 4. Generate Visual (Flat Lay Composition)
// This uses local canvas operations, not AI generation, which is preserved.
export const generateTryOnVisual = async (
  top: ClothingItem,
  bottom: ClothingItem,
  userProfile: UserProfile,
  styleName: string
): Promise<string> => {
  console.log("Creating local flat-lay composition with smart cropping...");
  
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas not supported");

      const width = 800;
      canvas.width = width;

      // 使用纯白色背景，更干净清爽
      ctx.fillStyle = '#ffffff'; 

      const imgTop = new Image();
      const imgBottom = new Image();
      let loaded = 0;
      let croppedTop: HTMLCanvasElement | null = null;
      let croppedBottom: HTMLCanvasElement | null = null;

      const onImageLoad = () => {
        loaded++;
        if (loaded === 2) {
          try {
            // 1. 检测并裁剪两张图片的空白区域
            const topBounds = getImageBounds(imgTop);
            const bottomBounds = getImageBounds(imgBottom);
            
            croppedTop = cropImageToBounds(imgTop, topBounds);
            croppedBottom = cropImageToBounds(imgBottom, bottomBounds);

            const padding = 20;
            const gap = 0; // 上衣和裤子之间无间隙，紧密拼接
            const availableWidth = width - (padding * 2);

            // 2. 计算裁剪后图片的显示尺寸（保持宽高比）
            const topRatio = croppedTop.width / croppedTop.height;
            const bottomRatio = croppedBottom.width / croppedBottom.height;

            // 让两张图片使用相同的显示宽度，看起来更协调
            // 选择两者中较小的宽度，确保都能完整显示
            const targetDisplayWidth = Math.min(
              availableWidth,
              Math.min(croppedTop.width, croppedBottom.width)
            );
            
            // 根据目标宽度计算高度
            let topDisplayWidth = targetDisplayWidth;
            let topDisplayHeight = topDisplayWidth / topRatio;
            
            let bottomDisplayWidth = targetDisplayWidth;
            let bottomDisplayHeight = bottomDisplayWidth / bottomRatio;

            // 如果总高度太大，按比例缩放
            const maxTotalHeight = 700; // 总高度限制
            const currentTotalHeight = topDisplayHeight + gap + bottomDisplayHeight;
            if (currentTotalHeight > maxTotalHeight) {
              const scale = maxTotalHeight / currentTotalHeight;
              topDisplayWidth *= scale;
              topDisplayHeight *= scale;
              bottomDisplayWidth *= scale;
              bottomDisplayHeight *= scale;
            }

            // 3. 计算画布高度（根据实际内容动态计算）
            const totalHeight = padding + topDisplayHeight + gap + bottomDisplayHeight + padding;
            canvas.height = totalHeight;

            // 4. 绘制背景
            // 选项1: 纯白色背景（干净简洁，推荐）
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, totalHeight);
            
            // 选项2: 浅色渐变背景（更柔和优雅，如需使用请取消注释并注释掉上面的纯白色）
            // const gradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
            // gradient.addColorStop(0, '#ffffff');      // 顶部：纯白
            // gradient.addColorStop(1, '#fafafa');      // 底部：极浅灰
            // ctx.fillStyle = gradient;
            // ctx.fillRect(0, 0, width, totalHeight);
            
            // 选项3: 其他颜色（可根据需要自定义）
            // ctx.fillStyle = '#f5f5f5';  // 浅灰色
            // ctx.fillStyle = '#f0f0f0';  // 稍深的浅灰
            // ctx.fillRect(0, 0, width, totalHeight);

            // 5. 计算居中位置并绘制
            const topX = padding + (availableWidth - topDisplayWidth) / 2;
            const topY = padding;
            
            const bottomX = padding + (availableWidth - bottomDisplayWidth) / 2;
            const bottomY = topY + topDisplayHeight + gap;

            // 绘制裁剪后的图片（带阴影效果）
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.1)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 8;
            ctx.drawImage(croppedTop, topX, topY, topDisplayWidth, topDisplayHeight);
            ctx.restore();

            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.1)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 8;
            ctx.drawImage(croppedBottom, bottomX, bottomY, bottomDisplayWidth, bottomDisplayHeight);
            ctx.restore();

            resolve(canvas.toDataURL('image/jpeg', 0.9));
          } catch (error) {
            console.error("Error in composition:", error);
            reject(error);
          }
        }
      };
      
      const onError = (e: any) => {
          console.error("Image load failed", e);
          reject(new Error("Failed to load clothing images for composition"));
      };

      imgTop.onload = onImageLoad;
      imgTop.onerror = onError;
      imgTop.src = `data:image/png;base64,${top.image}`; 

      imgBottom.onload = onImageLoad;
      imgBottom.onerror = onError;
      imgBottom.src = `data:image/png;base64,${bottom.image}`; 

    } catch (e) {
      reject(e);
    }
  });
};

function drawImageContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;

  let dw, dh, dx, dy;

  if (imgRatio > targetRatio) {
    dw = w;
    dh = w / imgRatio;
    dx = x;
    dy = y + (h - dh) / 2;
  } else {
    dh = h;
    dw = h * imgRatio;
    dy = y;
    dx = x + (w - dw) / 2;
  }

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.1)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}