# Vercel Deployment Checklist ✅

## ✅ All Issues Fixed!

### 1. **ES Modules Export** ✅ FIXED
- **Changed:** `module.exports` → `export default app`
- **Added:** Local development check for `app.listen()`
- **Status:** ✅ Properly configured for Vercel serverless functions

### 2. **Route Configuration** ✅ FIXED
- **Changed:** `/storefront-chatbot.js` → `/chatbot-widget.js` in `vercel.json`
- **Status:** ✅ Routes now match actual endpoints

### 3. **MongoDB Connection** ✅ FIXED
- **Added:** Connection caching for serverless functions
- **Features:**
  - Reuses connections across function invocations
  - Prevents connection pool exhaustion
  - Optimized with `bufferCommands: false`
- **Status:** ✅ Serverless-ready

### 4. **Build Configuration** ✅ VERIFIED
- **Build command:** `npm run build` (via `vercel-build`)
- **Output:** `dist/` folder
- **Status:** ✅ Configured correctly

### 5. **Static File Serving** ✅ VERIFIED
- **Routes:** `/assets/**` → `/dist/assets/**`
- **SPA Routes:** `/*` → `/dist/index.html`
- **Status:** ✅ Configured correctly

---

## Environment Variables Required

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required:
- ✅ `MONGODB_URI` - MongoDB connection string
- ✅ `VITE_SHOPIFY_API_KEY` - Shopify App API Key
- ✅ `SHOPIFY_API_SECRET` - Shopify App Secret
- ✅ `VITE_OPENAI_API_KEY` - OpenAI API Key

### Optional but Recommended:
- ✅ `APP_URL` - Your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
  - Used for script tag URLs
  - If not set, will use request headers (less reliable)

---

## Deployment Steps

### 1. **Set Environment Variables**
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add all required variables (see above)

### 2. **Deploy**
```bash
# Option 1: Via Vercel CLI
vercel --prod

# Option 2: Via Git Push (if connected to GitHub)
git push origin main
```

### 3. **Update Redirect URI**
After deployment, update your Shopify App's redirect URI:
1. Go to Shopify Partner Dashboard → Your App → App Setup
2. Update `Allowed redirection URL(s)` to:
   ```
   https://your-app.vercel.app/api/auth
   ```
3. Save changes

### 4. **Update APP_URL** (Recommended)
In Vercel Dashboard → Environment Variables:
- Add `APP_URL` = `https://your-app.vercel.app`

---

## Verification Checklist

After deployment, verify:

- [ ] Homepage loads (`https://your-app.vercel.app`)
- [ ] API health check works (`https://your-app.vercel.app/api/health`)
- [ ] OAuth flow works (install app on test store)
- [ ] Chatbot widget loads (`https://your-app.vercel.app/chatbot-widget.js?shop=test.myshopify.com`)
- [ ] Database connection works (check Vercel logs)
- [ ] Script tag is created after app installation
- [ ] Chatbot appears on storefront after installation

---

## Common Issues & Solutions

### Issue: "Module not found" errors
**Solution:** Make sure `vercel-build` script runs `npm run build`

### Issue: MongoDB connection errors
**Solution:** 
- Check `MONGODB_URI` is set correctly
- Verify MongoDB allows connections from Vercel IPs
- Check connection caching is working (should see "Connected to MongoDB" in logs)

### Issue: Script tag not loading
**Solution:**
- Set `APP_URL` environment variable
- Check `chatbot-widget.js` route is working
- Verify shop domain is passed correctly

### Issue: 404 on routes
**Solution:**
- Check `vercel.json` routes are correct
- Ensure `dist/` folder is built
- Verify route order (more specific routes first)

---

## File Structure Summary

```
/
├── vercel.json          ✅ Configured
├── package.json         ✅ Has vercel-build script
├── server/
│   └── index.js         ✅ Exports app for Vercel
├── src/                 ✅ Source files
└── dist/                ✅ Built output (created during build)
```

---

## ✅ All Systems Ready for Deployment!

Everything is configured correctly. You can now deploy to Vercel!
