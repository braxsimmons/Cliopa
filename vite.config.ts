import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    proxy: {
      // Proxy LM Studio requests to avoid CORS issues
      '/lm-studio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lm-studio/, ''),
      }
    }
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Production build optimizations
  build: {
    // Use esbuild for minification (faster, included by default)
    minify: 'esbuild',
  },
  esbuild: {
    // Remove console.log in production builds
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  // Define environment variables for runtime checks
  define: {
    __DEV__: mode !== 'production',
  },
}));
