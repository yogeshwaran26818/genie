# Vercel 404 Error - Fix Applied

## Problem
Getting `404: NOT_FOUND` error on Vercel deployment.

## Root Cause
Vercel requires Express.js apps to be in the `api/` folder structure for serverless functions, not the `server/` folder.

## Solution Applied

### 1. Created `api/index.js`
- Copied server code to `api/index.js`
- Updated import paths for models
- Updated dist folder paths

### 2. Updated `vercel.json`
- Switched from `builds` and `routes` to `rewrites` (modern Vercel syntax)
- Added build command and output directory
- Configured proper routing:
  - `/api/*` → `/api/index`
  - `/chatbot-widget.js` → `/api/index`
  - `/*` → `/index.html` (React SPA)

## Next Steps

1. **Commit and push** the changes
2. **Redeploy** on Vercel
3. **Verify** the routes work

## Testing After Deploy

- Homepage: `https://your-app.vercel.app/`
- API: `https://your-app.vercel.app/api/health`
- Chatbot widget: `https://your-app.vercel.app/chatbot-widget.js?shop=test.myshopify.com`

