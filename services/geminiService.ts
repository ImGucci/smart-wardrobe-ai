import { ClothingItem, UserProfile } from "../types";

// Configuration for API Providers
// Note: process.env variables are replaced at build time by Vite's define in vite.config.ts
// These will be replaced with string literals during build (e.g., "sk-or-v1-xxx" or "")
// @ts-ignore - process.env is replaced at build time, so TypeScript doesn't see it
const API_KEY: string | undefined = (process.env as any).API_KEY || undefined;
// @ts-ignore
const ZENMUX_API_KEY: string | undefined = (process.env as any).ZENMUX_API_KEY || undefined;
// @ts-ignore
const API_PROVIDER: string = ((process.env as any).API_PROVIDER || 'openrouter').toLowerCase();

// OpenRouter Configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.0-flash-001"; 
const OPENROUTER_IMAGE_MODEL = "google/gemini-3-pro-image-preview"; // For image generation

// ZenMux Configuration
const ZENMUX_API_URL = "https://zenmux.ai/v1/chat/completions";
const ZENMUX_TEXT_MODEL = "google/gemini-2.0-flash-001"; // For text generation
const ZENMUX_IMAGE_MODEL = "google/gemini-3-pro-image-preview"; // For image generation

// Common image generation model
const IMAGE_GENERATION_MODEL = "google/gemini-3-pro-image-preview";

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
 * Helper to call ZenMux API
 * Note: ZenMux may have CORS restrictions for browser requests
 */
const callZenMux = async (messages: any[], model: string = ZENMUX_TEXT_MODEL) => {
  if (!ZENMUX_API_KEY) {
    console.error("ZENMUX_API_KEY is missing or empty. Check Vercel environment variables.");
    throw new Error("ZenMux API Key is missing. Please check your ZENMUX_API_KEY environment variable in Vercel.");
  }

  console.log(`[ZenMux] Using model: ${model}`);
  console.log(`[ZenMux] API key length: ${ZENMUX_API_KEY.length} chars`);

  try {
    const response = await fetch(ZENMUX_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ZENMUX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("ZenMux API Error:", response.status, errorBody);
      let errorMessage = `ZenMux API Error (${response.status})`;
      try {
          const errJson = JSON.parse(errorBody);
          if (errJson.error && errJson.error.message) {
              errorMessage = errJson.error.message;
          }
          if (response.status === 401) {
            errorMessage = "Invalid ZenMux API key. Please check your ZENMUX_API_KEY environment variable in Vercel. " + 
                          (errJson.error?.message || "Authentication failed.");
          }
      } catch(e) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return content;
  } catch (error: any) {
    // Check if it's a CORS or network error
    const errorMessage = error?.message || '';
    const errorName = error?.name || '';
    
    if (errorMessage.includes('CORS') || 
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('network') ||
        errorName === 'TypeError' ||
        errorMessage.includes('preflight')) {
      const corsError = new Error("ZenMux API is not accessible from browser due to CORS restrictions. Please use OpenRouter for text generation, or set up a backend proxy for ZenMux.");
      (corsError as any).isCorsError = true;
      throw corsError;
    }
    // Re-throw other errors
    throw error;
  }
};

/**
 * Recursively search for image data in any object/array structure
 */
const findImageData = (obj: any, path: string = ''): string | null => {
  if (!obj || typeof obj !== 'object') return null;
  
  // Check common image field names
  const imageFields = ['inline_data', 'image_url', 'image', 'image_data', 'data', 'url'];
  for (const field of imageFields) {
    if (obj[field]) {
      const value = obj[field];
      if (typeof value === 'string' && (value.startsWith('data:image') || value.startsWith('/9j/') || value.startsWith('iVBORw0KGgo'))) {
        console.log(`[Image Search] Found image at path: ${path}.${field}`);
        return value;
      }
      if (typeof value === 'object' && value.data) {
        const mimeType = value.mime_type || 'image/jpeg';
        console.log(`[Image Search] Found image at path: ${path}.${field}.data`);
        return `data:${mimeType};base64,${value.data}`;
      }
      if (typeof value === 'object' && value.url) {
        console.log(`[Image Search] Found image at path: ${path}.${field}.url`);
        return value.url;
      }
    }
  }
  
  // Recursively search in arrays and objects
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = findImageData(obj[i], `${path}[${i}]`);
      if (result) return result;
    }
  } else {
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && key !== 'reasoning' && key !== 'text') {
        const result = findImageData(obj[key], path ? `${path}.${key}` : key);
        if (result) return result;
      }
    }
  }
  
  return null;
};

/**
 * Helper to call OpenRouter API
 */
const callOpenRouter = async (messages: any[], model?: string, responseFormat?: 'json_object' | 'text') => {
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

  // For image generation models, we need to specify modalities (OpenRouter format)
  const isImageGeneration = model === IMAGE_GENERATION_MODEL;
  
  const requestBody: any = {
    model: model || OPENROUTER_MODEL,
    messages: messages,
  };
  
  // Add modalities for image generation models (OpenRouter format)
  // According to OpenRouter docs: https://openrouter.ai/google/gemini-3-pro-image-preview/api
  // Use "modalities": ["image", "text"] to request image generation
  if (isImageGeneration) {
    requestBody.modalities = ["image", "text"];  // OpenRouter format for image generation
    console.log("[OpenRouter] Adding modalities for image generation:", requestBody.modalities);
    console.log("[OpenRouter] Request body (first 2000 chars):", JSON.stringify(requestBody).substring(0, 2000));
  }
  
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": SITE_URL, // Required by OpenRouter (note: this is the correct header name for OpenRouter)
      "X-Title": APP_TITLE,     // Required by OpenRouter
    },
    body: JSON.stringify(requestBody)
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
  
  // Log the full response for debugging (especially for image generation)
  if (model === IMAGE_GENERATION_MODEL) {
    // Log full response structure (not truncated)
    console.log("[OpenRouter] Full image generation response:", JSON.stringify(data, null, 2));
    // Also log response size
    const responseSize = JSON.stringify(data).length;
    console.log(`[OpenRouter] Response size: ${responseSize} characters`);
  }
  
  // For image generation, the response structure might be different
  // Check multiple possible locations for the image data
  let content = "";
  
  if (data.choices && data.choices.length > 0) {
    const choice = data.choices[0];
    
    // Check message.content (could be string or array)
    // According to OpenRouter docs, images are returned as base64-encoded data URLs in assistant message
    if (choice.message) {
      if (typeof choice.message.content === 'string') {
        content = choice.message.content;
        // Check if it's a data URL (image)
        if (content.startsWith('data:image')) {
          console.log("[OpenRouter] Found image data URL in message.content (string)");
        }
      } else if (Array.isArray(choice.message.content)) {
        // Content might be an array with image parts
        console.log(`[OpenRouter] message.content is array with ${choice.message.content.length} items`);
        for (let i = 0; i < choice.message.content.length; i++) {
          const part = choice.message.content[i];
          console.log(`[OpenRouter] content[${i}] type:`, typeof part, part?.type || 'no type');
          
          // Check for image_url type
          if (part.type === 'image_url' && part.image_url?.url) {
            content = part.image_url.url;
            console.log("[OpenRouter] Found image in content array (image_url type)");
            break;
          }
          // Check for image type
          if (part.type === 'image' && part.image) {
            content = part.image;
            console.log("[OpenRouter] Found image in content array (image type)");
            break;
          }
          // Check if part is a string (could be data URL)
          if (typeof part === 'string' && part.startsWith('data:image')) {
            content = part;
            console.log("[OpenRouter] Found image data URL in content array (string)");
            break;
          }
          // Check if part is just a string (might be base64)
          if (typeof part === 'string' && part.length > 100) {
            // Could be base64 image data
            content = part;
            console.log("[OpenRouter] Found potential image data in content array (long string)");
            break;
          }
        }
      }
      
      // Check for image in message.parts (Gemini native format)
      if (!content && choice.message.parts && Array.isArray(choice.message.parts)) {
        for (const part of choice.message.parts) {
          // Check inline_data (base64 image data)
          if (part.inline_data && part.inline_data.data) {
            const mimeType = part.inline_data.mime_type || 'image/jpeg';
            content = `data:${mimeType};base64,${part.inline_data.data}`;
            console.log("[OpenRouter] Found image in message.parts.inline_data");
            break;
          }
          // Check image_url
          if (part.image_url && part.image_url.url) {
            content = part.image_url.url;
            console.log("[OpenRouter] Found image in message.parts.image_url");
            break;
          }
          // Check if part itself is an image object
          if (part.type === 'image' && part.data) {
            content = part.data;
            break;
          }
        }
      }
      
      // Check reasoning_details array (Gemini 3 Pro may put images here)
      if (!content && choice.message.reasoning_details && Array.isArray(choice.message.reasoning_details)) {
        console.log(`[OpenRouter] Checking reasoning_details array (length: ${choice.message.reasoning_details.length})`);
        for (let i = 0; i < choice.message.reasoning_details.length; i++) {
          const detail = choice.message.reasoning_details[i];
          console.log(`[OpenRouter] reasoning_details[${i}] type: ${detail.type}, keys:`, Object.keys(detail));
          
          // Check all possible image types
          if (detail.type === 'image' || 
              detail.type === 'image_url' || 
              detail.type === 'reasoning.image' ||
              detail.type?.includes('image')) {
            console.log(`[OpenRouter] Found image type in reasoning_details[${i}]`);
            if (detail.inline_data && detail.inline_data.data) {
              const mimeType = detail.inline_data.mime_type || 'image/jpeg';
              content = `data:${mimeType};base64,${detail.inline_data.data}`;
              console.log("[OpenRouter] Found image in reasoning_details.inline_data");
              break;
            }
            if (detail.image_url && detail.image_url.url) {
              content = detail.image_url.url;
              console.log("[OpenRouter] Found image in reasoning_details.image_url");
              break;
            }
            if (detail.data) {
              content = detail.data;
              console.log("[OpenRouter] Found image in reasoning_details.data");
              break;
            }
            if (detail.url) {
              content = detail.url;
              console.log("[OpenRouter] Found image in reasoning_details.url");
              break;
            }
          }
          
          // Check for inline_data in any detail (regardless of type)
          if (detail.inline_data && detail.inline_data.data) {
            const mimeType = detail.inline_data.mime_type || 'image/jpeg';
            content = `data:${mimeType};base64,${detail.inline_data.data}`;
            console.log(`[OpenRouter] Found image in reasoning_details[${i}].inline_data (type: ${detail.type})`);
            break;
          }
          
          // Check nested parts in reasoning_details
          if (detail.parts && Array.isArray(detail.parts)) {
            console.log(`[OpenRouter] Checking reasoning_details[${i}].parts (length: ${detail.parts.length})`);
            for (const part of detail.parts) {
              if (part.inline_data && part.inline_data.data) {
                const mimeType = part.inline_data.mime_type || 'image/jpeg';
                content = `data:${mimeType};base64,${part.inline_data.data}`;
                console.log("[OpenRouter] Found image in reasoning_details.parts.inline_data");
                break;
              }
            }
            if (content) break;
          }
        }
      }
      
      // Check for image in message (direct fields)
      if (!content && choice.message.image) {
        content = choice.message.image;
      }
      if (!content && choice.message.image_url) {
        content = choice.message.image_url;
      }
      if (!content && choice.message.image_data) {
        content = choice.message.image_data;
      }
    }
    
    // Check choice-level fields
    if (!content && choice.image) {
      content = choice.image;
    }
    if (!content && choice.image_url) {
      content = choice.image_url;
    }
    if (!content && choice.image_data) {
      content = choice.image_data;
    }
  }
  
  // Check top-level fields
  if (!content && data.image) {
    content = data.image;
  }
  if (!content && data.image_url) {
    content = data.image_url;
  }
  if (!content && data.image_data) {
    content = data.image_data;
  }
  
  // For Gemini image generation, check if there's a separate image field in the response
  // Some models return images in a different structure
  if (!content && data.data && typeof data.data === 'string') {
    content = data.data;
  }
  
  // Last resort: recursively search the entire response for image data
  if (!content && isImageGeneration) {
    console.log("[OpenRouter] Recursively searching response for image data...");
    const foundImage = findImageData(data, 'response');
    if (foundImage) {
      content = foundImage;
      console.log("[OpenRouter] Found image data via recursive search");
    }
  }
  
  if (!content && isImageGeneration) {
    console.warn("[OpenRouter] No image content found in response");
    console.warn("[OpenRouter] Full response keys:", Object.keys(data));
    if (data.choices && data.choices[0]) {
      console.warn("[OpenRouter] Choice keys:", Object.keys(data.choices[0]));
      if (data.choices[0].message) {
        const message = data.choices[0].message;
        console.warn("[OpenRouter] Message keys:", Object.keys(message));
        
        // Log all message fields in detail
        Object.keys(message).forEach(key => {
          const value = message[key];
          if (value === null || value === undefined) {
            console.warn(`[OpenRouter] Message.${key}:`, value);
          } else if (typeof value === 'string') {
            console.warn(`[OpenRouter] Message.${key} (string, length ${value.length}):`, value.substring(0, 200));
          } else if (Array.isArray(value)) {
            console.warn(`[OpenRouter] Message.${key} (array, length ${value.length}):`, JSON.stringify(value).substring(0, 1000));
            // Check each item in the array
            value.forEach((item: any, idx: number) => {
              if (item && typeof item === 'object') {
                console.warn(`[OpenRouter] Message.${key}[${idx}] keys:`, Object.keys(item));
                // Check for image data in this item
                if (item.inline_data) {
                  console.warn(`[OpenRouter] Found inline_data in ${key}[${idx}]:`, Object.keys(item.inline_data));
                }
                if (item.image_url) {
                  console.warn(`[OpenRouter] Found image_url in ${key}[${idx}]:`, item.image_url);
                }
              }
            });
          } else if (typeof value === 'object') {
            console.warn(`[OpenRouter] Message.${key} (object) keys:`, Object.keys(value));
          }
        });
      }
    }
    // Log full response for deep inspection
    console.warn("[OpenRouter] Full response JSON:", JSON.stringify(data, null, 2));
  }
  
  return content;
};

/**
 * Unified API call function - routes to the correct provider based on configuration
 * Falls back to OpenRouter if ZenMux fails due to CORS or other issues
 */
const callAPI = async (messages: any[], model?: string) => {
  if (API_PROVIDER === 'zenmux') {
    try {
      return await callZenMux(messages, model);
    } catch (error: any) {
      // Check if it's a CORS or network error
      const errorMessage = error?.message || '';
      const isCorsError = error?.isCorsError || 
                         errorMessage.includes('CORS') || 
                         errorMessage.includes('Failed to fetch') || 
                         errorMessage.includes('network') ||
                         errorMessage.includes('preflight') ||
                         error?.name === 'TypeError';
      
      if (isCorsError) {
        console.warn('[API] ZenMux call failed due to CORS restrictions, automatically falling back to OpenRouter');
        console.warn('[API] Note: ZenMux API cannot be called directly from browser. Consider using OpenRouter for all text generation.');
        // Fall back to OpenRouter for text generation
        if (!API_KEY) {
          throw new Error("OpenRouter API_KEY is required for fallback. Please set API_KEY environment variable.");
        }
        return await callOpenRouter(messages);
      }
      // Re-throw other errors
      throw error;
    }
  } else {
    return await callOpenRouter(messages);
  }
};

// Helper to clean JSON string (remove markdown code blocks if model adds them)
const parseJSON = (text: string) => {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
};

// 1. Analyze Item - Enhanced with detailed fashion analysis
export const analyzeClothingItem = async (base64Image: string): Promise<{ 
  // 基础字段（向后兼容）
  color: string; 
  type: string; 
  style: string; 
  season: string; 
  category?: string;
  
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
  formality?: number;
  style_tags?: string[];
}> => {
  return callWithRetry(async () => {
    // OpenRouter Vision format expects a Data URL
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;
    
    const prompt = `你是一位 AI 时尚专家。你的任务是分析一张单品衣物的图片，并将其视觉特征转化为结构化的 JSON 数据。

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

注意：formality 必须是 1 到 5 之间的数字，不要加引号。`;
    
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
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

    const responseText = await callAPI(messages);
    if (!responseText) throw new Error("No response from AI");
    
    try {
        const result = parseJSON(responseText);
        console.log("AI Analysis Result (detailed):", result);
        
        // Ensure formality is a number if present
        if (result.formality !== undefined) {
          result.formality = typeof result.formality === 'string' 
            ? parseInt(result.formality, 10) 
            : Number(result.formality);
          // Clamp to 1-5 range
          if (isNaN(result.formality) || result.formality < 1) result.formality = 1;
          if (result.formality > 5) result.formality = 5;
        }
        
        // Ensure color_palette and style_tags are arrays
        if (result.color_palette && !Array.isArray(result.color_palette)) {
          result.color_palette = [];
        }
        if (result.style_tags && !Array.isArray(result.style_tags)) {
          result.style_tags = typeof result.style_tags === 'string' 
            ? [result.style_tags] 
            : [];
        }
        
        return result;
    } catch (e) {
        console.error("Failed to parse AI response:", responseText);
        throw new Error("AI response was not valid JSON");
    }
  });
};

// 2. Generate Advice - Enhanced with detailed clothing analysis
export const generateOutfitAdvice = async (
  tops: ClothingItem[],
  bottoms: ClothingItem[],
  context: string,
  userProfile: UserProfile
): Promise<{ topId: string; bottomId: string; reasoning: string; styleName: string }> => {
  return callWithRetry(async () => {
    // Build detailed inventory description using enhanced tags
    const buildItemDetails = (item: ClothingItem) => {
      const tags = item.tags;
      return {
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
        // 向后兼容
        color: tags.color || tags.dominant_color,
        type: tags.type || tags.sub_category,
        style: tags.style || (tags.style_tags?.[0] || 'Casual'),
      };
    };

    const inventoryDescription = JSON.stringify({
      tops: tops.map(buildItemDetails),
      bottoms: bottoms.map(buildItemDetails),
    }, null, 2);

    const prompt = `你是一位专业的时尚搭配师。请根据用户的场景需求和衣橱库存，推荐最合适的搭配组合。

用户信息：
- 性别: ${userProfile.gender}
- 身高: ${userProfile.height}
- 体重: ${userProfile.weight}
- 肤色: ${userProfile.skinTone}

场景需求：
"${context}"

衣橱库存：
${inventoryDescription}

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
}`;

    const messages = [
        { role: "user", content: prompt }
    ];

    const responseText = await callAPI(messages);
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
 * Generate Digital Human Image using AI (gemini-3-pro-image-preview)
 * This creates a realistic digital human wearing the recommended outfit
 * Supports both OpenRouter and ZenMux providers
 */
export const generateDigitalHuman = async (
  top: ClothingItem,
  bottom: ClothingItem,
  userProfile: UserProfile,
  styleName: string
): Promise<string> => {
  return callWithRetry(async () => {
    console.log(`[Digital Human] Generating with ${API_PROVIDER} using ${IMAGE_GENERATION_MODEL}...`);
    
    // Build the prompt with user profile information
    // IMPORTANT: For image generation models, we need to explicitly request image generation
    const prompt = `You are an image generation model. Generate a realistic full-body digital human image showing a person wearing this outfit combination.

User Profile:
- Gender: ${userProfile.gender}
- Height: ${userProfile.height}
- Weight: ${userProfile.weight}
- Skin Tone: ${userProfile.skinTone}
- Style: ${styleName}

Image Requirements:
1. Generate a full-body photograph of a person wearing the provided top and bottom clothing items
2. The person must match the user's profile: ${userProfile.gender}, ${userProfile.height}, ${userProfile.weight}, ${userProfile.skinTone} skin tone
3. The clothing should fit naturally and look realistic on the person
4. Use a clean, professional background (white or light gray)
5. The image must be high quality and photorealistic
6. The person should be standing in a natural pose, facing forward or slightly to the side
7. Show the complete outfit combination clearly

IMPORTANT: You must generate and return an image, not a text description. Generate a realistic photograph showing how this outfit looks when worn by a person matching the user's profile.`;

    // Prepare messages with images
    const messages: any[] = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt
          }
        ]
      }
    ];

    // Add user avatar if available
    if (userProfile.avatarImage) {
      messages[0].content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${userProfile.avatarImage}`
        }
      });
    }

    // Add clothing images
    messages[0].content.push(
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${top.image}`
        }
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${bottom.image}`
        }
      }
    );

    // Use the appropriate API based on provider
    let responseText: string;
    if (API_PROVIDER === 'zenmux') {
      if (!ZENMUX_API_KEY) {
        throw new Error("ZENMUX_API_KEY is required when using ZenMux provider");
      }
      responseText = await callZenMux(messages, IMAGE_GENERATION_MODEL);
    } else {
      // Use OpenRouter
      if (!API_KEY) {
        throw new Error("API_KEY is required for image generation");
      }
      console.log(`[Digital Human] Calling OpenRouter with model: ${IMAGE_GENERATION_MODEL}`);
      responseText = await callOpenRouter(messages, IMAGE_GENERATION_MODEL);
    }
    
    console.log(`[Digital Human] Received response, length: ${responseText?.length || 0} chars`);
    console.log(`[Digital Human] Response preview: ${responseText?.substring(0, 200) || 'empty'}`);
    
    if (!responseText || responseText.trim().length === 0) {
      throw new Error("No response from AI image generation - response was empty");
    }

    console.log("[Digital Human] Processing AI response...");

    // The response might be in different formats:
    // 1. Direct data URL: "data:image/jpeg;base64,..."
    // 2. Base64 string: "iVBORw0KGgo..." or "/9j/..."
    // 3. JSON with image data: {"image": "base64..."}
    // 4. JSON with content: {"content": [{"type": "image_url", "image_url": {...}}]}
    // 5. Text description (if model didn't generate image) - we need to detect this

    // Check if it's already a data URL
    if (responseText.startsWith('data:image')) {
      console.log("[Digital Human] Response is data URL");
      return responseText;
    }
    
    // Check if response looks like a text description (not an image)
    // If it contains common text patterns, it might be a description instead of image data
    const textIndicators = ['sorry', 'cannot', 'unable', 'error', 'description', 'text'];
    const lowerResponse = responseText.toLowerCase().substring(0, 200);
    if (textIndicators.some(indicator => lowerResponse.includes(indicator)) && 
        !responseText.match(/^[A-Za-z0-9+/=\s]+$/)) {
      console.warn("[Digital Human] Response appears to be text description, not image data");
      console.warn("[Digital Human] Response preview:", responseText.substring(0, 500));
      throw new Error("AI returned text description instead of image. The model may not support image generation or the prompt needs adjustment.");
    }

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(responseText);
      
      // Check for nested content structure (Gemini format)
      if (parsed.content && Array.isArray(parsed.content)) {
        for (const item of parsed.content) {
          if (item.type === 'image_url' && item.image_url?.url) {
            const imageUrl = item.image_url.url;
            if (imageUrl.startsWith('data:')) {
              console.log("[Digital Human] Found image in content array");
              return imageUrl;
            }
            // If it's base64 without data URL prefix
            if (imageUrl.match(/^[A-Za-z0-9+/=]+$/)) {
              console.log("[Digital Human] Found base64 in content array");
              return `data:image/jpeg;base64,${imageUrl}`;
            }
          }
        }
      }
      
      // Check for direct image/data fields
      if (parsed.image || parsed.data) {
        const imageData = parsed.image || parsed.data;
        if (imageData.startsWith('data:')) {
          console.log("[Digital Human] Found image in JSON");
          return imageData;
        }
        if (imageData.match(/^[A-Za-z0-9+/=]+$/)) {
          console.log("[Digital Human] Found base64 in JSON");
          return `data:image/jpeg;base64,${imageData}`;
        }
      }
      
      // Check for choices array (OpenAI format)
      if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices.length > 0) {
        const choice = parsed.choices[0];
        if (choice.message?.content) {
          const content = choice.message.content;
          if (content.startsWith('data:image')) {
            console.log("[Digital Human] Found image in choices");
            return content;
          }
        }
      }
    } catch (e) {
      // Not JSON, continue to base64 check
      console.log("[Digital Human] Response is not JSON, checking as base64");
    }

    // Check if it's a base64 string (JPEG starts with /9j/, PNG starts with iVBORw0KGgo)
    if (responseText.startsWith('/9j/') || responseText.startsWith('iVBORw0KGgo') || 
        responseText.match(/^[A-Za-z0-9+/=\s]+$/)) {
      // Remove whitespace
      const cleanBase64 = responseText.replace(/\s/g, '');
      console.log("[Digital Human] Response is base64 string");
      return `data:image/jpeg;base64,${cleanBase64}`;
    }

    // If we can't parse it, throw an error
    console.error("[Digital Human] Could not parse response:", responseText.substring(0, 200));
    throw new Error("Unable to extract image from AI response. Response format not recognized.");
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

// 4. Generate Visual
// Priority: Try AI digital human generation first (using gemini-3-pro-image-preview)
// Fallback: Use local canvas composition if AI generation fails
export const generateTryOnVisual = async (
  top: ClothingItem,
  bottom: ClothingItem,
  userProfile: UserProfile,
  styleName: string
): Promise<string> => {
  // Always try AI digital human generation first (works with both OpenRouter and ZenMux)
  console.log(`[Visual] Attempting AI digital human generation with ${API_PROVIDER}...`);
  try {
    return await generateDigitalHuman(top, bottom, userProfile, styleName);
  } catch (error: any) {
    const errorMessage = error?.message || '';
    console.warn("[Visual] AI digital human generation failed:", errorMessage);
    console.warn("[Visual] Falling back to local canvas composition...");
    // Fall through to local composition
  }
  
  // Local flat-lay composition (fallback)
  console.log("[Visual] Creating local flat-lay composition with smart cropping...");
  
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