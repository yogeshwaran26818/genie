# Environment Variables Configuration Guide

## Required Environment Variables

Your existing `.env` variables are fine! The customer account functionality now uses **database-stored configuration** instead of environment variables.

```bash
# Server Configuration (you already have these)
PORT=3000
VITE_SHOPIFY_API_KEY=your_admin_api_key
VITE_SHOPIFY_REDIRECT_URI=http://localhost:3000/api/auth
SHOPIFY_API_SECRET=your_admin_api_secret
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
VITE_OPENAI_API_KEY=sk-proj-your-openai-api-key

# NO ADDITIONAL ENVIRONMENT VARIABLES NEEDED!
# Customer account configuration is now stored in the database per shop
```

## Database Configuration (NEW APPROACH)

The customer account functionality now fetches configuration from your database:

### Shop Model Fields Added:
- `storefront_access_token` - Storefront API token (from app installation)
- `customer_account_client_id` - Customer Account API client ID
- `customer_account_client_secret` - Customer Account API client secret

### How It Works:
1. **App Installation**: When a store installs your Aladdyn app, store the `storefront_access_token`
2. **Customer Account Setup**: Configure Customer Account API credentials for each shop
3. **Dynamic Configuration**: The chatbot fetches the right tokens for each shop from the database

## Current Status
✅ Your existing environment variables are perfect
✅ No additional `.env` variables needed
✅ Configuration is now per-shop in the database
✅ More secure and scalable approach

## Testing
The customer login functionality will work automatically once:
1. A shop has installed your Aladdyn app (has `storefront_access_token`)
2. Customer Account API credentials are configured for that shop
3. The shop is found in your database

This approach is much better because each shop can have its own configuration!
