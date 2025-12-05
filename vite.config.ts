import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const cwd = path.resolve();
  const env = loadEnv(mode, cwd, '');
  
  // 1. Prioritize explicitly set env var (Netlify/System)
  // 2. Fallback to loaded env (.env file)
  let finalApiKey = process.env.API_KEY || env.API_KEY || '';
  
  // 3. Fallback: Read from api_key.txt if present (Local Development)
  // Logic: If the env var is empty or looks like a placeholder, try the file.
  if (!finalApiKey || finalApiKey.includes('placeholder')) {
    try {
      const keyPath = path.resolve(cwd, 'api_key.txt');
      if (fs.existsSync(keyPath)) {
        const fileContent = fs.readFileSync(keyPath, 'utf-8').trim();
        // Basic check to ensure it's not empty
        if (fileContent.length > 5) {
            finalApiKey = fileContent;
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

  return {
    plugins: [react()],
    define: {
      // Safely inject the key into the client code
      'process.env.API_KEY': JSON.stringify(finalApiKey)
    },
    build: {
      target: 'esnext' // Ensure support for modern JS features
    }
  };
});