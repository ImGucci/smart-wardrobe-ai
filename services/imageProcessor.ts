import { removeBackground } from '@imgly/background-removal';

/**
 * IMAGE PROCESSOR SERVICE
 * 
 * Strategy: Hybrid Online Loading with Multiple CDN Fallbacks
 * 
 * 1. The code driver (JS) is bundled via 'npm install'.
 * 2. The Heavy Assets (WASM/ONNX models) are fetched from a CDN at runtime.
 * 
 * CORS FIX: Using multiple CDN strategies with automatic fallback:
 * - jsDelivr (npm): Primary CDN with proper CORS support
 * - jsDelivr (gh): GitHub-based CDN as fallback
 * - Library default: Let the library handle model loading
 * 
 * This approach ensures reliability even if one CDN has issues.
 */

export const removeImageBackground = async (base64Image: string): Promise<string> => {
  // 1. Convert Base64 string to Blob
  const byteCharacters = atob(base64Image);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' });

  // Try multiple CDN strategies with fallback
  const cdnStrategies = [
    {
      name: 'jsDelivr',
      publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.4.5/dist/'
    },
    {
      name: 'jsDelivr (gh)',
      publicPath: 'https://cdn.jsdelivr.net/gh/imgly/background-removal-data@1.4.5/dist/'
    },
    {
      name: 'default (no publicPath)',
      publicPath: undefined
    }
  ];

  for (const strategy of cdnStrategies) {
    try {
      console.log(`[ImageProcessor] Trying ${strategy.name}...`);
      if (strategy.publicPath) {
        console.log(`[ImageProcessor] Fetching Models from: ${strategy.publicPath}`);
      } else {
        console.log(`[ImageProcessor] Using library default model path`);
      }

      // Configure the AI Engine
      const config: any = {
        debug: false, // Reduce console noise
        progress: (key: string, current: number, total: number) => {
          if (total > 0 && current === total) {
            console.log(`[AI Download] ${key} completed via ${strategy.name}.`);
          }
        }
      };

      // Only set publicPath if strategy provides one
      if (strategy.publicPath) {
        config.publicPath = strategy.publicPath;
      }

      // Run Inference
      const resultBlob = await removeBackground(blob, config);
      
      // Convert Result Blob back to Base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]); 
        };
        reader.onerror = () => reject(new Error("Failed to read processed image"));
        reader.readAsDataURL(resultBlob);
      });

    } catch (error: any) {
      console.warn(`[ImageProcessor] ${strategy.name} failed:`, error.message);
      // Continue to next strategy
      continue;
    }
  }

  // All strategies failed
  console.error("[ImageProcessor] All CDN strategies failed. Using original image as fallback.");
  return base64Image;
};