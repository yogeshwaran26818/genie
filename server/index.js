import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import Shop from '../src/models/Shop.js'
import Genie from '../src/models/Genie.js'


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

// Genie API routes
app.post('/api/genie/check', async (req, res) => {
  try {
    const { shop } = req.body
    const genie = await Genie.findOne({ shopify_domain: shop })
    res.json({ exists: !!genie, genie })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/verify-email', async (req, res) => {
  try {
    const { email, shop } = req.body
    
    // Get shop's access token
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ verified: false, error: 'Shop not found' })
    }

    // Search for customer by email in Shopify
    const response = await fetch(`https://${shop}/admin/api/2025-07/customers/search.json?query=email:${email}`, {
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
      },
    })

    if (!response.ok) {
      return res.json({ verified: false, error: 'Failed to verify email' })
    }

    const data = await response.json()
    const verified = data.customers && data.customers.length > 0
    
    res.json({ verified, customer: verified ? data.customers[0] : null })
  } catch (error) {
    console.error('Email verification error:', error)
    res.status(500).json({ verified: false, error: error.message })
  }
})

app.post('/api/genie/generate', async (req, res) => {
  try {
    const { shop } = req.body
    
    const existing = await Genie.findOne({ shopify_domain: shop })
    if (existing) {
      return res.status(400).json({ error: 'Script already exists for this shop' })
    }

    const scriptId = `genie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const scriptContent = `(function() {
  console.log('Aladdyn Genie loaded for ${shop}');
  
  window.AladdynGenie = {
    shopDomain: '${shop}',
    scriptId: '${scriptId}',
    awaitingEmail: false,
    customerEmail: null,
    currentProducts: null,
    
    init: function() {
      this.createChatbot();
      console.log('Genie chatbot initialized');
    },
    
    createChatbot: function() {
      const chatWidget = document.createElement('div');
      chatWidget.id = 'aladdyn-chatbot';
      chatWidget.innerHTML = \`
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
          <div id="chat-toggle" style="width: 60px; height: 60px; background: #7c3aed; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <span style="color: white; font-size: 24px;">💬</span>
          </div>
          <div id="chat-window" style="display: none; width: 350px; height: 500px; background: white; border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); position: absolute; bottom: 70px; right: 0;">
            <div style="padding: 20px; border-bottom: 1px solid #eee; background: #7c3aed; color: white; border-radius: 10px 10px 0 0;">
              <h3 style="margin: 0; font-size: 16px;">Aladdyn Assistant</h3>
            </div>
            <div id="chat-messages" style="height: 350px; overflow-y: auto; padding: 15px;"></div>
            <div style="padding: 15px; border-top: 1px solid #eee;">
              <input id="chat-input" type="text" placeholder="Type your message..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; outline: none;">
            </div>
          </div>
        </div>
      \`;
      
      document.body.appendChild(chatWidget);
      this.bindEvents();
      this.addWelcomeMessage();
    },
    
    bindEvents: function() {
      const toggle = document.getElementById('chat-toggle');
      const window = document.getElementById('chat-window');
      const input = document.getElementById('chat-input');
      
      toggle.onclick = () => {
        window.style.display = window.style.display === 'none' ? 'block' : 'none';
      };
      
      input.onkeypress = (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          this.sendMessage(input.value.trim());
          input.value = '';
        }
      };
    },
    
    addWelcomeMessage: function() {
      this.addMessage('Hello! Please enter your registered email to continue.', 'bot');
      this.awaitingEmail = true;
    },
    
    sendMessage: function(message) {
      this.addMessage(message, 'user');
      
      if (this.awaitingEmail) {
        this.verifyEmail(message);
      } else {
        this.handleChatMessage(message);
      }
    },
    
    verifyEmail: async function(email) {
      this.addMessage('Verifying your email...', 'bot');
      
      try {
        const response = await fetch('http://localhost:3000/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email,
            shop: this.shopDomain 
          })
        });
        
        const result = await response.json();
        
        if (result.verified) {
          this.awaitingEmail = false;
          this.customerEmail = email;
          this.addMessage('Email verified! How can I assist you today?', 'bot');
        } else {
          this.addMessage('Email not found. Please enter your registered email.', 'bot');
        }
      } catch (error) {
        this.addMessage('Verification failed. Please try again.', 'bot');
      }
    },
    
    handleChatMessage: async function(message) {
      this.addMessage('I\'m ready to help! MCP functionality will be implemented soon.', 'bot');
    },
    
    addMessage: function(text, sender) {
      const messages = document.getElementById('chat-messages');
      const msg = document.createElement('div');
      msg.style.cssText = \`margin-bottom: 10px; padding: 8px 12px; border-radius: 15px; max-width: 80%; \${sender === 'user' ? 'background: #7c3aed; color: white; margin-left: auto; text-align: right;' : 'background: #f1f5f9; color: #334155;'}\`;
      msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
    }
  };
  
  window.AladdynGenie.init();
})();`

    const genie = new Genie({
      shopify_domain: shop,
      script_id: scriptId,
      script_content: scriptContent
    })

    await genie.save()
    res.json({ success: true, genie })
  } catch (error) {
    res.status(500).json({ error: error.message })
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