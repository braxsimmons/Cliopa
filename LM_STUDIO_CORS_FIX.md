# 🔧 LM Studio CORS Fix

## Problem
The browser is blocking requests from `http://localhost:8081` to `http://localhost:1234` due to CORS policy.

**Error:**
```
Access to fetch at 'http://localhost:1234/v1/models' from origin 'http://localhost:8081'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

---

## Solutions

### **Option 1: Enable CORS in LM Studio (Recommended)**

1. Open **LM Studio**
2. Go to **Local Server** tab (left sidebar)
3. Click **Server Options** or **Advanced Settings** (gear icon)
4. Find and enable one of these:
   - ✅ **Enable CORS**
   - ✅ **Allow All Origins**
   - Or add `http://localhost:8081` to **Allowed Origins**
5. **Restart the server** (Stop → Start)
6. Refresh the Cliopa.io app

---

### **Option 2: Use LM Studio CLI with CORS Enabled**

If the GUI doesn't have CORS options, start LM Studio server from command line:

**Mac/Linux:**
```bash
lms server start --cors
```

**Windows:**
```powershell
lms.exe server start --cors
```

**Or with specific origins:**
```bash
lms server start --cors-origin http://localhost:8081
```

---

### **Option 3: Run Cliopa.io on Same Origin (Quick Fix)**

Change your Vite dev server to run on `http://localhost:1234` instead:

1. Edit `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 1235, // Use different port, close to LM Studio
    proxy: {
      '/v1': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      }
    }
  }
})
```

2. Restart dev server: `npm run dev`
3. Access app at `http://localhost:1235`

---

### **Option 4: Browser Extension (Development Only)**

**⚠️ Only for testing, not recommended for production**

Install a CORS browser extension:
- Chrome: [CORS Unblock](https://chrome.google.com/webstore/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino)
- Firefox: [CORS Everywhere](https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/)

Enable the extension and refresh the page.

---

### **Option 5: Proxy Through Vite Dev Server (Best for Development)**

Add a proxy to your Vite config to route LM Studio requests through your dev server:

**Edit `vite.config.ts`:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 8081,
    proxy: {
      '/lm-studio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/lm-studio/, '')
      }
    }
  }
})
```

**Then update `lmStudioClient.ts`:**
```typescript
const DEFAULT_CONFIG: LMStudioConfig = {
  baseURL: "/lm-studio/v1", // Use proxy instead of direct localhost:1234
  model: "qwen/qwen3-vl-4b",
  temperature: 0.7,
  maxTokens: 4000,
};
```

Restart dev server: `npm run dev`

---

## Verify Fix

Once CORS is enabled, you should see in the console:

✅ **Success:**
```
LM Studio model auto-set to: qwen/qwen3-vl-4b
```

And in the AI Audit page:
```
✓ LM Studio (Local) - Connected [Toggle: ON]
```

---

## Recommended Solution

**For immediate fix:** Use **Option 5 (Vite Proxy)** - it's the cleanest development solution and doesn't require LM Studio configuration changes.

**For long-term:** Enable CORS in LM Studio settings (**Option 1**) so you can use it with any application.

---

## Still Having Issues?

Check LM Studio logs:
1. LM Studio → Local Server → Logs tab
2. Look for incoming requests
3. Verify the server is actually running on port 1234

Verify LM Studio is accessible:
```bash
curl http://localhost:1234/v1/models
```

Should return JSON with model info if working correctly.
