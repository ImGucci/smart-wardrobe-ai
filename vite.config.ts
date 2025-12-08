import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const cwd = path.resolve();
  const env = loadEnv(mode, cwd, '');
  
  // 1. Prioritize explicitly set env var (Vercel/System) - check both process.env and loadEnv
  // Vercel exposes env vars directly in process.env during build
  let finalApiKey = process.env.API_KEY || env.API_KEY || '';
  let finalZenmuxApiKey = process.env.ZENMUX_API_KEY || env.ZENMUX_API_KEY || '';
  let apiProvider = (process.env.API_PROVIDER || env.API_PROVIDER || 'openrouter').toLowerCase();
  
  // Validate API provider
  if (apiProvider !== 'openrouter' && apiProvider !== 'zenmux') {
    console.warn(`[Vite Config] Invalid API_PROVIDER: ${apiProvider}, defaulting to 'openrouter'`);
    apiProvider = 'openrouter';
  }
  
  // Debug logging (only show first/last few chars for security)
  if (finalApiKey) {
    const masked = finalApiKey.length > 8 
      ? `${finalApiKey.substring(0, 4)}...${finalApiKey.substring(finalApiKey.length - 4)}`
      : '***';
    console.log(`[Vite Config] API_KEY found (${finalApiKey.length} chars): ${masked}`);
  } else {
    console.warn('[Vite Config] API_KEY not found in environment variables');
  }
  
  if (finalZenmuxApiKey) {
    const masked = finalZenmuxApiKey.length > 8 
      ? `${finalZenmuxApiKey.substring(0, 4)}...${finalZenmuxApiKey.substring(finalZenmuxApiKey.length - 4)}`
      : '***';
    console.log(`[Vite Config] ZENMUX_API_KEY found (${finalZenmuxApiKey.length} chars): ${masked}`);
  }
  
  console.log(`[Vite Config] API_PROVIDER: ${apiProvider}`);
  
  // 2. Fallback: Read from api_key.txt if present (Local Development only)
  // Logic: If the env var is empty or looks like a placeholder, try the file.
  if (!finalApiKey || finalApiKey.includes('placeholder')) {
    try {
      const keyPath = path.resolve(cwd, 'api_key.txt');
      if (fs.existsSync(keyPath)) {
        const fileContent = fs.readFileSync(keyPath, 'utf-8').trim();
        // Basic check to ensure it's not empty
        if (fileContent.length > 5) {
            finalApiKey = fileContent;
            console.log('[Vite Config] Using API_KEY from api_key.txt (local dev)');
        }
      }
    } catch (e) {
      console.warn("Could not read api_key.txt");
    }
  }

  // Handle case where finalApiKey is still the literal placeholder string from some templates
  if (finalApiKey === 'GEMINI_API_KEY') {
    finalApiKey = '';
  }
  
  // Final validation
  if (!finalApiKey) {
    console.error('[Vite Config] WARNING: API_KEY is empty! The app will not work without a valid API key.');
  }

  return {
    plugins: [react()],
    define: {
      // Safely inject the keys and config into the client code
      // Use empty string instead of undefined to avoid issues
      'process.env.API_KEY': JSON.stringify(finalApiKey || ''),
      'process.env.ZENMUX_API_KEY': JSON.stringify(finalZenmuxApiKey || ''),
      'process.env.API_PROVIDER': JSON.stringify(apiProvider || 'openrouter')
    },
    build: {
      target: 'esnext' // Ensure support for modern JS features
    }
  };
});