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





app.post('/api/chat', async (req, res) => {
  try {
    const { message, shop } = req.body
    
    if (!message || !shop) {
      return res.status(400).json({ success: false, error: 'Message and shop required' })
    }

    // Get shop record
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ success: false, error: 'Shop not found' })
    }

    // Simple response without email verification
    let response = 'Thank you for your message! I\'m here to help with any questions about our products and services. How can I assist you today?'
    
    res.json({ success: true, response })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ success: false, error: error.message })
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



// Serve test page
app.get('/test-chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test-chatbot.html'))
})



// Get existing script
app.get('/api/genie/script/:shop', async (req, res) => {
  try {
    const { shop } = req.params
    const genie = await Genie.findOne({ shopify_domain: shop, is_active: true })
    
    if (!genie) {
      return res.status(404).json({ error: 'Script not found' })
    }
    
    res.setHeader('Content-Type', 'application/javascript')
    res.send(genie.script_content)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/genie/generate', async (req, res) => {
  try {
    const { shop } = req.body

    // Check if script already exists
    const existing = await Genie.findOne({ shopify_domain: shop, is_active: true })
    if (existing) {
      return res.json({ success: true, genie: existing, message: 'Script already exists', scriptUrl: `/api/genie/script/${shop}` })
    }

    const scriptId = `genie_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const scriptContent = `<script>window.ALADDYN_SHOP='${shop}';window.ALADDYN_SCRIPT_ID='${scriptId}';</script><script src="http://localhost:3000/chatbot.js"></script>`

    const genie = new Genie({
      shopify_domain: shop,
      script_id: scriptId,
      script_content: scriptContent
    })

    await genie.save()
    res.json({ success: true, genie, scriptUrl: `/api/genie/script/${shop}` })
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