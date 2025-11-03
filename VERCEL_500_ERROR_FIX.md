# Vercel 500 Error - Diagnosis & Fix

## Error
```
500: INTERNAL_SERVER_ERROR
Code: FUNCTION_INVOCATION_FAILED
```

## Common Causes

### 1. **Missing Environment Variables** ⚠️ Most Likely
Check Vercel Dashboard → Settings → Environment Variables:

**Required:**
- ✅ `MONGODB_URI` - Must be set
- ✅ `VITE_SHOPIFY_API_KEY` - Must be set  
- ✅ `SHOPIFY_API_SECRET` - Must be set
- ✅ `VITE_OPENAI_API_KEY` - Must be set

### 2. **MongoDB Connection Issues**
- Connection string might be invalid
- MongoDB might not allow connections from Vercel IPs
- Network timeout in serverless environment

### 3. **Import Path Issues**
- Models are in `src/models/` 
- API file is in `api/index.js`
- Path should be: `../../src/models/Shop.js` ✅

### 4. **APP_URL Trailing Slash** ✅ FIXED
**Answer: NO trailing slash needed**

Set in Vercel:
```
APP_URL=https://genie-three-tau.vercel.app
```

NOT:
```
APP_URL=https://genie-three-tau.vercel.app/
```

The code now handles this automatically by removing trailing slashes.

## Fixes Applied

1. ✅ **Better MongoDB Connection Handling**
   - Added `ensureDBConnection()` function
   - Connection established on first request
   - Better error messages

2. ✅ **Improved Error Handling**
   - Detailed logging for debugging
   - Specific error messages for each step
   - Environment variable checks

3. ✅ **APP_URL Trailing Slash Handling**
   - Automatically removes trailing slash
   - Works with or without slash

## How to Debug

1. **Check Vercel Logs**
   - Go to Vercel Dashboard → Your Project → Functions
   - Click on the failed function
   - Check the logs for error messages

2. **Check Environment Variables**
   - Vercel Dashboard → Settings → Environment Variables
   - Verify all required variables are set
   - Make sure no typos

3. **Test MongoDB Connection**
   - Verify `MONGODB_URI` is correct
   - Test connection string locally
   - Check MongoDB network access

## Environment Variables Setup

In Vercel Dashboard → Settings → Environment Variables:

```
MONGODB_URI=mongodb+srv://...
VITE_SHOPIFY_API_KEY=your_key_here
SHOPIFY_API_SECRET=your_secret_here
VITE_OPENAI_API_KEY=your_key_here
APP_URL=https://genie-three-tau.vercel.app
```

**Important:** 
- NO trailing slash in `APP_URL` ✅
- All values should be set for Production, Preview, and Development

## After Fix

Redeploy on Vercel and check logs again. The improved error handling will show exactly what's failing.
