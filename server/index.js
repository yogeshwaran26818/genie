import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import Shop from '../src/models/Shop.js'
import Chatbot from '../src/models/Chatbot.js'
import CustomerAuth from '../src/models/CustomerAuth.js'



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
      await CustomerAuth.findOneAndUpdate(
        { shopify_domain: shop },
        { 
          shopify_domain: shop,
          storefront_access_token: storefrontToken
        },
        { upsert: true, new: true }
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

    await CustomerAuth.findOneAndUpdate(
      { shopify_domain: shop },
      { customer_account_client_id, customer_account_client_secret },
      { upsert: true, new: true }
    )

    res.json({ success: true, message: 'Customer auth credentials stored' })
  } catch (error) {
    console.error('Store customer auth error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Generate chatbot script
app.post('/api/generate-script', async (req, res) => {
  try {
    const { shop } = req.body
    
    if (!shop) {
      return res.status(400).json({ success: false, error: 'Shop domain required' })
    }

    // Check if script already exists
    const existing = await Chatbot.findOne({ shopify_domain: shop, is_active: true })
    if (existing) {
      return res.json({ 
        success: true, 
        script: existing.script_content, 
        scriptId: existing.script_id,
        message: 'Script already exists for this shop'
      })
    }

    const scriptId = `chatbot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const script = `<script>
(function() {
  console.log('Chatbot loaded for ${shop}');
  
  const chatWidget = document.createElement('div');
  chatWidget.innerHTML = \`
    <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
      <div id="chat-toggle-${scriptId}" style="width: 60px; height: 60px; background: #7c3aed; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <span style="color: white; font-size: 24px;">💬</span>
      </div>
      <div id="chat-window-${scriptId}" style="display: none; width: 350px; height: 400px; background: white; border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); position: absolute; bottom: 70px; right: 0;">
        <div style="padding: 15px; border-bottom: 1px solid #eee; background: #7c3aed; color: white; border-radius: 10px 10px 0 0;">
          <h3 style="margin: 0; font-size: 16px;">Chat Assistant</h3>
        </div>
        <div id="chat-messages-${scriptId}" style="height: 250px; overflow-y: auto; padding: 15px;">
          <div style="background: #f1f5f9; color: #334155; padding: 8px 12px; border-radius: 15px; margin-bottom: 10px; max-width: 80%;">
            Hello! What can I do for you?
          </div>
        </div>
        <div style="padding: 15px; border-top: 1px solid #eee;">
          <input id="chat-input-${scriptId}" type="text" placeholder="Type your message..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 5px; outline: none;">
        </div>
      </div>
    </div>
  \`;
  
  document.body.appendChild(chatWidget);
  
  const toggle = document.getElementById('chat-toggle-${scriptId}');
  const window = document.getElementById('chat-window-${scriptId}');
  const input = document.getElementById('chat-input-${scriptId}');
  const messages = document.getElementById('chat-messages-${scriptId}');
  
  toggle.onclick = () => {
    window.style.display = window.style.display === 'none' ? 'block' : 'none';
  };
  
  input.onkeypress = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      const msg = document.createElement('div');
      msg.style.cssText = 'background: #7c3aed; color: white; padding: 8px 12px; border-radius: 15px; margin-bottom: 10px; max-width: 80%; margin-left: auto; text-align: right;';
      msg.textContent = input.value;
      messages.appendChild(msg);
      
      // Show typing indicator
      const typing = document.createElement('div');
      typing.style.cssText = 'background: #f1f5f9; color: #334155; padding: 8px 12px; border-radius: 15px; margin-bottom: 10px; max-width: 80%;';
      typing.innerHTML = 'Bot is typing<span style="animation: dots 1.5s infinite;">...</span><style>@keyframes dots { 0%, 20% { opacity: 0; } 40% { opacity: 1; } 100% { opacity: 0; } }</style>';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      
      // Send to API
      fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.value, shop: '${shop}' })
      })
      .then(r => r.json())
      .then(data => {
        messages.removeChild(typing);
        const reply = document.createElement('div');
        reply.style.cssText = 'background: #f1f5f9; color: #334155; padding: 8px 12px; border-radius: 15px; margin-bottom: 10px; max-width: 80%;';
        
        if (data.requiresAuth) {
          reply.innerHTML = data.response + '<br><button onclick="window.open(\'' + data.loginUrl + '\', \'_blank\')" style="background: #7c3aed; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; margin-top: 8px;">Sign In</button>';
        } else {
          reply.textContent = data.response || 'Sorry, I couldn\'t process that.';
        }
        
        messages.appendChild(reply);
        messages.scrollTop = messages.scrollHeight;
      })
      .catch(() => {
        messages.removeChild(typing);
        const reply = document.createElement('div');
        reply.style.cssText = 'background: #f1f5f9; color: #334155; padding: 8px 12px; border-radius: 15px; margin-bottom: 10px; max-width: 80%;';
        reply.textContent = 'Sorry, I\'m having trouble connecting.';
        messages.appendChild(reply);
        messages.scrollTop = messages.scrollHeight;
      });
      
      input.value = '';
    }
  };
})();
</script>`

    // Save new script to database
    const chatbot = new Chatbot({
      shopify_domain: shop,
      script_id: scriptId,
      script_content: script
    })

    await chatbot.save()
    res.json({ success: true, script, scriptId, message: 'New script generated' })
  } catch (error) {
    console.error('Script generation error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// Serve test chatbot page
app.get('/test-chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-chatbot.html'))
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