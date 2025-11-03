# Troubleshooting: Storefront Token & Script Tag Creation Errors

## Common Error: "Failed to create storefront token" / "Failed to create script tag"

If you see these errors during app installation, here are the most likely causes and fixes:

---

## 1. **Missing OAuth Scopes** ⚠️ (Most Common)

### Problem:
The app hasn't requested or been granted the required scopes.

### Required Scopes:
- `write_storefront_access_tokens` - To create Storefront tokens
- `write_script_tags` - To create script tags
- `read_script_tags` - To read script tags

### Solution:
1. **Update OAuth URL** - Already done in `Login.jsx`:
   ```javascript
   scope=read_customers,read_inventory,read_orders,read_products,write_script_tags,read_script_tags
   ```

2. **Re-install the app** to grant new scopes:
   - Uninstall the app from Shopify admin
   - Go to your app's OAuth page
   - Click "Install" again
   - Approve the new permissions

3. **Check Partner Dashboard**:
   - Go to your Shopify Partner Dashboard
   - Find your app → API Credentials
   - Ensure scopes include:
     - ✅ `write_storefront_access_tokens`
     - ✅ `write_script_tags`
     - ✅ `read_script_tags`

---

## 2. **API Version Issues**

### Problem:
Using wrong API version in GraphQL queries.

### Current Code Uses:
- Storefront Token: `2025-07` ✅
- Script Tag: `2025-07` ✅

### If Errors Persist:
Try updating to latest API version in Partner Dashboard.

---

## 3. **HTTP Errors (401/403)**

### Problem:
Authentication or permission errors.

### Check:
1. **Access Token Valid?**
   - Token should be valid after OAuth
   - Check if token has expired

2. **Permissions Granted?**
   - Merchant must approve all scopes
   - Some scopes require admin approval

### Solution:
- Re-authenticate the app
- Make sure merchant approves ALL permissions

---

## 4. **Response Structure Issues**

### Problem:
API response doesn't match expected structure.

### New Error Logging:
The updated code now logs:
- HTTP status codes
- Full API responses
- User errors
- GraphQL errors

### What to Look For:
Check console for:
```
⚠️ Failed to create storefront token
   Full Response: { ... }
```

This will show the actual error message.

---

## 5. **Development Store Limitations**

### Problem:
Some development stores have restrictions.

### Solution:
- Use a development store with proper permissions
- Or test with a real store (if available)

---

## Debugging Steps

### Step 1: Check Console Logs
With the updated error handling, you'll now see:
```
⚠️ Failed to create storefront token
   User Errors: [...]
   GraphQL Errors: [...]
   Full Response: {...}
```

**Look for:**
- Specific error messages
- Missing scope warnings
- Permission denied errors

### Step 2: Verify Scopes
1. Go to Shopify Admin → Apps → Your App
2. Check "API access scopes"
3. Verify all required scopes are listed:
   - ✅ `write_storefront_access_tokens`
   - ✅ `write_script_tags`
   - ✅ `read_script_tags`

### Step 3: Test Manually
Test the API calls manually to see the exact error:

```bash
# Test Storefront Token Creation
curl -X POST "https://YOUR_STORE.myshopify.com/admin/api/2025-07/graphql.json" \
  -H "X-Shopify-Access-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { storefrontAccessTokenCreate(input: { title: \"Test\" }) { storefrontAccessToken { accessToken } userErrors { field message } } }"
  }'
```

### Step 4: Check App Permissions
In Partner Dashboard:
1. Go to your app
2. Navigate to "API access scopes"
3. Ensure scopes include:
   - `write_storefront_access_tokens`
   - `write_script_tags`

---

## Expected Success Output

When working correctly, you should see:
```
Creating Storefront access token...
✅ Storefront access token created and stored successfully!
Creating Script Tag to embed chatbot...
✅ Chatbot script tag created successfully!
   Script URL: http://localhost:3000/chatbot-widget.js?shop=...
```

---

## Quick Fix Checklist

- [ ] OAuth URL includes `write_script_tags,read_script_tags` scopes
- [ ] App has been re-installed after adding scopes
- [ ] Partner Dashboard shows all required scopes
- [ ] Access token is valid (not expired)
- [ ] API version is correct (2025-07)
- [ ] Check console for detailed error messages
- [ ] Merchant approved all permissions during install

---

## Still Not Working?

1. **Check the detailed error logs** - The updated code now shows full API responses
2. **Verify in Partner Dashboard** - Ensure scopes are configured
3. **Re-install the app** - Sometimes scopes need fresh approval
4. **Test with curl** - Manually test API calls to see exact errors

The improved error logging will now show you exactly what's wrong!

