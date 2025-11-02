import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import Shop from '../src/models/Shop.js'
import Customer from '../src/models/Customer.js'



const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err))

// Exchange authorization code for access token
const exchangeCodeForToken = async (code, shop) => {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.VITE_SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code: code,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to exchange code for token')
  }

  return await response.json()
}



// Fetch shop info from Shopify
const fetchShopInfo = async (shop, accessToken) => {
  const response = await fetch(`https://${shop}/admin/api/2025-07/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch shop info')
  }

  return await response.json()
}

// Fetch products from Shopify using GraphQL
const fetchProducts = async (shop, accessToken) => {
  const query = `
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            vendor
            featuredImage {
              url
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }
    }
  `

  const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { first: 50 }
    })
  })

  if (!response.ok) {
    throw new Error('Failed to fetch products')
  }

  const data = await response.json()

  // Transform GraphQL response to match REST format
  const products = data.data.products.edges.map(edge => ({
    id: edge.node.id,
    title: edge.node.title,
    vendor: edge.node.vendor,
    image: edge.node.featuredImage ? { src: edge.node.featuredImage.url } : null,
    variants: edge.node.variants.edges.map(variantEdge => ({
      id: variantEdge.node.id,
      price: variantEdge.node.price
    }))
  }))

  return { products }
}

// Fetch customers from Shopify
const fetchCustomers = async (shop, accessToken) => {
  const response = await fetch(`https://${shop}/admin/api/2025-07/customers.json?limit=50`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch customers')
  }

  return await response.json()
}

// Fetch all orders
const fetchAllOrders = async (shop, accessToken) => {
  const response = await fetch(`https://${shop}/admin/api/2025-07/orders.json?status=any&limit=50`, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch orders')
  }

  return await response.json()
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working',
    env: {
      hasApiKey: !!process.env.VITE_SHOPIFY_API_KEY,
      hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
      hasMongoUri: !!process.env.MONGODB_URI
    }
  })
})

// Routes
app.get('/api/auth', async (req, res) => {
  try {
    console.log('Auth request received:', req.query)
    const { code, shop, state } = req.query

    if (!code || !shop || !state) {
      console.log('Missing parameters:', { code: !!code, shop: !!shop, state: !!state })
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    console.log('Exchanging code for token...')
    const tokenData = await exchangeCodeForToken(code, shop)
    console.log('Token received successfully')

    console.log('Saving to MongoDB...')
    await Shop.findOneAndUpdate(
      { shopify_domain: shop },
      {
        shopify_domain: shop,
        shopify_access_token: tokenData.access_token
      },
      { upsert: true, new: true }
    )
    console.log('Shop saved successfully')

    console.log('Redirecting to frontend...')
    res.redirect(`http://localhost:${PORT}/shopify/callback?shop=${shop}&success=true`)
  } catch (error) {
    console.error('Auth error:', error)
    const errorMessage = encodeURIComponent(error.message)
    res.redirect(`http://localhost:${PORT}/shopify/callback?error=${errorMessage}`)
  }
})

app.post('/api/shop-info', async (req, res) => {
  try {
    const { shop } = req.body

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Fetch shop info, products, customers, and orders
    const [shopInfo, productsData, customersData, ordersData] = await Promise.all([
      fetchShopInfo(shop, shopRecord.shopify_access_token),
      fetchProducts(shop, shopRecord.shopify_access_token),
      fetchCustomers(shop, shopRecord.shopify_access_token),
      fetchAllOrders(shop, shopRecord.shopify_access_token)
    ])

    // Debug: Log first order to see structure
    if (ordersData.orders && ordersData.orders.length > 0) {
      console.log('First order structure:', JSON.stringify(ordersData.orders[0], null, 2))
    }

    res.json({
      shop: shopInfo.shop,
      products: productsData.products,
      customers: customersData.customers,
      orders: ordersData.orders
    })
  } catch (error) {
    console.error('Shop info error:', error)
    res.status(500).json({ error: error.message })
  }
})





















// Chat endpoint with OpenAI integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, shop } = req.body

    if (!message || !shop) {
      return res.status(400).json({ success: false, error: 'Message and shop required' })
    }

    // Get shop data
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }



    // Check if message requires authentication
    const authRequiredKeywords = ['cart', 'my cart', 'add to cart', 'past order', 'my order', 'order history', 'purchase']
    const requiresAuth = authRequiredKeywords.some(keyword => message.toLowerCase().includes(keyword))

    if (requiresAuth) {
      return res.json({
        success: true,
        requiresAuth: true,
        loginUrl: `https://${shop}/account/login?return_url=/apps/chatbot-bridge`,
        response: 'To access your cart and order information, please sign in to your account.'
      })
    }

    // Fetch store data
    const [shopInfo, productsData] = await Promise.all([
      fetchShopInfo(shop, shopRecord.shopify_access_token),
      fetchProducts(shop, shopRecord.shopify_access_token)
    ])

    // Prepare context for OpenAI
    const storeContext = {
      shop: shopInfo.shop.name,
      products: productsData.products.map(p => ({
        title: p.title,
        price: p.variants?.[0]?.price || '0.00',
        vendor: p.vendor
      }))
    }

    // OpenAI API call
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful store assistant for ${storeContext.shop}. When customers ask about products, provide a clean, well-formatted response. Available products: ${storeContext.products.map(p => `${p.title} - $${p.price}`).join(', ')}. Keep responses concise and friendly. Format product lists nicely with proper spacing and structure.`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    })

    const aiResult = await openaiResponse.json()
    const response = aiResult.choices?.[0]?.message?.content || 'I\'m sorry, I couldn\'t process your request right now.'

    res.json({ success: true, response })
  } catch (error) {
    console.error('Chat error:', error)
    res.json({ success: true, response: 'I\'m here to help! You can ask me about our products and prices.' })
  }
})

// Enhanced Genie chat endpoint with full dashboard data
app.post('/api/chat/genie', async (req, res) => {
  try {
    const { message, shop, customerEmail } = req.body

    if (!message || !shop) {
      return res.status(400).json({ success: false, error: 'Message and shop required' })
    }

    // Check if message requires customer authentication (cart, orders, etc.)
    const authRequiredKeywords = ['cart', 'my cart', 'add to cart', 'past order', 'my order', 'order history', 'purchase', 'my purchases', 'checkout', 'my account']
    const requiresAuth = authRequiredKeywords.some(keyword => message.toLowerCase().includes(keyword))

    // If auth required and no customer email provided, return login prompt
    if (requiresAuth && !customerEmail) {
      const shopRecord = await Shop.findOne({ shopify_domain: shop })
      if (!shopRecord) {
        return res.status(404).json({ success: false, error: 'Shop not found' })
      }

      // Generate login URL
      const returnUrl = encodeURIComponent(`${req.protocol}://${req.get('host')}/chat`)
      const loginUrl = `/api/customer-auth/login?shop=${encodeURIComponent(shop)}&return_url=${returnUrl}`

      return res.json({
        success: true,
        requiresAuth: true,
        loginUrl: loginUrl,
        response: 'To access your cart and order information, please sign in to your store account.',
        message: 'Authentication required'
      })
    }

    // Get shop record
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }

    // Fetch all dashboard data
    const [shopInfo, productsData, customersData, ordersData] = await Promise.all([
      fetchShopInfo(shop, shopRecord.shopify_access_token),
      fetchProducts(shop, shopRecord.shopify_access_token),
      fetchCustomers(shop, shopRecord.shopify_access_token),
      fetchAllOrders(shop, shopRecord.shopify_access_token)
    ])

    // Prepare comprehensive context for OpenAI
    const storeContext = {
      shopName: shopInfo.shop.name,
      shopEmail: shopInfo.shop.email,
      shopDomain: shopInfo.shop.domain,
      totalProducts: productsData.products.length,
      products: productsData.products.map(p => ({
        title: p.title,
        price: p.variants?.[0]?.price || '0.00',
        vendor: p.vendor || 'N/A',
        variants: p.variants?.length || 0
      })),
      totalCustomers: customersData.customers?.length || 0,
      customers: customersData.customers?.slice(0, 10).map(c => ({
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
        email: c.email,
        ordersCount: c.orders_count || 0
      })) || [],
      totalOrders: ordersData.orders?.length || 0,
      recentOrders: ordersData.orders?.slice(0, 10).map(o => ({
        orderNumber: o.order_number || o.name,
        total: o.total_price,
        status: o.financial_status,
        fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
        createdAt: o.created_at,
        itemsCount: o.line_items?.length || 0
      })) || []
    }

    // Build comprehensive system prompt
    const systemPrompt = `You are Genie, an AI assistant helping a Shopify store owner manage their store. You have access to real-time store data.

STORE INFORMATION:
- Store Name: ${storeContext.shopName}
- Domain: ${storeContext.shopDomain}
- Email: ${storeContext.shopEmail}

PRODUCTS (${storeContext.totalProducts} total):
${storeContext.products.length > 0 ? storeContext.products.map((p, i) => `${i + 1}. ${p.title} - $${p.price} (${p.vendor})`).join('\\n') : 'No products available'}

CUSTOMERS (${storeContext.totalCustomers} total):
${storeContext.customers.length > 0 ? storeContext.customers.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} (${c.email}) - ${c.ordersCount} orders`).join('\\n') : 'No customers yet'}

ORDERS (${storeContext.totalOrders} total):
${storeContext.recentOrders.length > 0 ? storeContext.recentOrders.slice(0, 5).map((o, i) => `${i + 1}. Order #${o.orderNumber} - $${o.total} (${o.status}) - ${o.itemsCount} items`).join('\\n') : 'No orders yet'}

INSTRUCTIONS:
- Answer questions about products, orders, customers, and store information accurately
- Use the actual data provided above
- Format responses clearly with bullet points or numbered lists when appropriate
- Be helpful, friendly, and professional
- If asked about data not available, politely say you don't have that information
- Keep responses concise but informative`

    // OpenAI API call
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error('Failed to get AI response')
    }

    const aiResult = await openaiResponse.json()
    const response = aiResult.choices?.[0]?.message?.content || 'I\'m sorry, I couldn\'t process your request right now. Please try again.'

    // If customer is authenticated and asking about cart/orders, fetch their data
    if (customerEmail && requiresAuth) {
      const customerRecord = await Customer.findOne({
        shopify_domain: shop,
        customer_email: customerEmail
      })

      if (customerRecord && customerRecord.customer_access_token) {
        // You can enhance this to fetch actual customer cart/orders using the access token
        // For now, just return the AI response
        return res.json({
          success: true,
          response: response + '\n\n(You are logged in as ' + customerEmail + ')',
          authenticated: true
        })
      }
    }

    res.json({ success: true, response })
  } catch (error) {
    console.error('Genie chat error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
      response: 'I\'m having trouble accessing the store data right now. Please try again in a moment.'
    })
  }
})

// Customer Authentication - Initiate login
app.get('/api/customer-auth/login', async (req, res) => {
  try {
    const { shop, return_url } = req.query

    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter required' })
    }

    // Get shop record
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Check if Customer Account API is configured
    if (shopRecord.customer_account_client_id && shopRecord.customer_account_client_secret) {
      // ✅ Customer Account API is configured - Use OAuth flow
      // This URL will work and exchange tokens properly
      console.log(`✅ Using Customer Account API OAuth flow for shop: ${shop}`)

      // Generate state for OAuth security
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

      // Customer Account API OAuth URL
      const clientId = shopRecord.customer_account_client_id
      const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/api/customer-auth/callback`)
      const scopes = 'openid email https://api.shopify.com/auth/customer.graphql'

      // This URL will work IF Customer Account API app is registered in Shopify
      const authUrl = `https://shopify.com/myshopify/customer_account/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&shop=${encodeURIComponent(shop)}`

      console.log(`   OAuth URL: ${authUrl}`)
      console.log(`   Redirect URI: ${req.protocol}://${req.get('host')}/api/customer-auth/callback`)

      res.redirect(authUrl)
    } else {
      // ❌ Customer Account API NOT configured - Use store login (limited functionality)
      // NOTE: Store login doesn't provide OAuth tokens, so we can't exchange for API access
      // This is a fallback that just redirects to store login page
      console.log(`⚠️ Customer Account API not configured. Redirecting to store login page.`)
      console.log(`   ⚠️ NOTE: Store login won't provide API tokens for token exchange.`)

      // Redirect to store's customer login page
      const returnUrl = return_url || encodeURIComponent(`${req.protocol}://${req.get('host')}/chat`)
      const storeLoginUrl = `https://${shop}/account/login?return_url=${returnUrl}`

      console.log(`   Store login URL: ${storeLoginUrl}`)

      res.redirect(storeLoginUrl)
    }
  } catch (error) {
    console.error('Customer auth login error:', error)
    res.status(500).json({ error: 'Failed to initiate login' })
  }
})

// Customer Authentication - OAuth Callback
// This endpoint receives the authorization code from Shopify after user logs in
app.get('/api/customer-auth/callback', async (req, res) => {
  try {
    const { code, state, shop } = req.query

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' })
    }

    // Extract shop parameter from query
    // Shopify should include shop parameter in the callback URL
    const shopParam = shop

    if (!shopParam) {
      console.error('❌ Shop parameter missing in callback')
      return res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h2>Error</h2>
            <p>Shop parameter is required but was not provided.</p>
            <p>The shop parameter should be included in the authorization URL.</p>
          </body>
        </html>
      `)
    }

    console.log(`📥 Received callback with authorization code`)
    console.log(`   Shop: ${shopParam}`)
    console.log(`   Authorization code received: ${code.substring(0, 20)}...`)

    // Get shop record
    const shopRecord = await Shop.findOne({ shopify_domain: shopParam })
    if (!shopRecord || !shopRecord.customer_account_client_id || !shopRecord.customer_account_client_secret) {
      return res.status(404).json({ error: 'Customer Account API not configured' })
    }

    // Exchange authorization code for access token
    // This is the token exchange between Shopify store and our backend
    console.log(`🔄 Exchanging authorization code for access token...`)
    console.log(`   Shop: ${shopParam}`)
    console.log(`   Client ID: ${shopRecord.customer_account_client_id}`)

    const tokenResponse = await fetch('https://shopify.com/myshopify/customer_account/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: shopRecord.customer_account_client_id,
        client_secret: shopRecord.customer_account_client_secret,
        code: code,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/customer-auth/callback`
      })
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('❌ Token exchange error:', errorData)
      throw new Error('Failed to exchange authorization code')
    }

    const tokenData = await tokenResponse.json()
    console.log(`✅ Token exchange successful!`)
    console.log(`   Access token received: ${tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'N/A'}`)

    // Get customer information using the access token
    const customerInfoResponse = await fetch(`https://customeraccount.shopify.com/customer/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `query {
          customer {
            id
            email
            firstName
            lastName
          }
        }`
      })
    })

    let customerEmail = 'unknown@example.com'
    let customerId = null

    if (customerInfoResponse.ok) {
      const customerData = await customerInfoResponse.json()
      customerEmail = customerData.data?.customer?.email || customerEmail
      customerId = customerData.data?.customer?.id || null
    }

    // Store customer token in database
    const customerRecord = await Customer.findOneAndUpdate(
      {
        shopify_domain: shopParam,
        customer_email: customerEmail
      },
      {
        shopify_domain: shopParam,
        customer_email: customerEmail,
        customer_access_token: tokenData.access_token,
        customer_id: customerId,
        session_id: tokenData.session_id || null
      },
      { upsert: true, new: true }
    )

    console.log(`✅ Customer token stored successfully for ${customerEmail} at shop ${shopParam}`)
    console.log(`📝 Token: ${tokenData.access_token.substring(0, 20)}...`)
    console.log(`🆔 Customer ID: ${customerId}`)

    // Show success page instead of redirecting (user will handle redirect manually)
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 500px;
            width: 90%;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
          }
          .success-icon svg {
            width: 50px;
            height: 50px;
            color: white;
          }
          h1 {
            color: #1f2937;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .email {
            color: #6b7280;
            font-size: 16px;
            margin: 10px 0 30px 0;
          }
          .message {
            background: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            color: #065f46;
            margin: 20px 0;
            font-size: 14px;
          }
          .details {
            background: #f9fafb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: left;
            font-size: 12px;
            color: #6b7280;
          }
          .details strong {
            color: #1f2937;
          }
          .back-button {
            background: #7c3aed;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 20px;
            transition: background 0.2s;
          }
          .back-button:hover {
            background: #6d28d9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h1>Successfully Logged In!</h1>
          <p class="email">${customerEmail}</p>
          <div class="message">
            ✅ Your account has been successfully authenticated.<br>
            📝 Your access token has been securely stored.
            </div>
          <div class="details">
            <strong>Token Exchange Details:</strong><br>
            Shop: ${shopParam}<br>
            Customer ID: ${customerId || 'N/A'}<br>
            Status: Token stored in database
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            You can now close this window and return to the chat.
          </p>
          <button class="back-button" onclick="window.close()">Close Window</button>
        </div>
      </body>
      </html>
    `)
  } catch (error) {
    console.error('Customer auth callback error:', error)
    res.status(500).send(`<html><body><h2>Login Failed</h2><p>${error.message}</p><p><a href="/chat">Return to Chat</a></p></body></html>`)
  }
})

// Create Storefront Access Token
app.post('/api/create-storefront-token', async (req, res) => {
  try {
    const { shop } = req.body

    if (!shop) {
      return res.status(400).json({ success: false, error: 'Shop domain required' })
    }

    // Get admin access token
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }

    // Create Storefront Access Token using Admin API
    const response = await fetch(`https://${shop}/admin/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
            storefrontAccessTokenCreate(input: $input) {
              userErrors {
                field
                message
              }
              shop {
                id
              }
              storefrontAccessToken {
                accessScopes {
                  handle
                }
                accessToken
                title
              }
            }
          }
        `,
        variables: {
          input: {
            title: 'Chatbot Storefront Access Token'
          }
        }
      })
    })

    const result = await response.json()

    if (result.data?.storefrontAccessTokenCreate?.storefrontAccessToken) {
      const storefrontToken = result.data.storefrontAccessTokenCreate.storefrontAccessToken.accessToken

      // Store the storefront token
      await Shop.findOneAndUpdate(
        { shopify_domain: shop },
        {
          storefront_access_token: storefrontToken
        },
        { upsert: false, new: true }
      )

      res.json({
        success: true,
        storefrontToken,
        message: 'Storefront access token created and stored'
      })
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to create storefront token',
        details: result.data?.storefrontAccessTokenCreate?.userErrors
      })
    }
  } catch (error) {
    console.error('Create storefront token error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Store customer auth credentials
app.post('/api/store-customer-auth', async (req, res) => {
  try {
    const { shop, customer_account_client_id, customer_account_client_secret } = req.body

    if (!shop || !customer_account_client_id || !customer_account_client_secret) {
      return res.status(400).json({ success: false, error: 'All fields required' })
    }

    await Shop.findOneAndUpdate(
      { shopify_domain: shop },
      { customer_account_client_id, customer_account_client_secret },
      { upsert: false, new: true }
    )

    res.json({ success: true, message: 'Customer auth credentials stored' })
  } catch (error) {
    console.error('Store customer auth error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})



// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Serve static files
app.use(express.static(path.join(__dirname, '../dist')))

// Serve React app for all non-API routes
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  } else {
    res.status(404).json({ error: 'API endpoint not found' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})