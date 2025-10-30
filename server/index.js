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

// Store login callback route
app.get('/api/store-login/callback', async (req, res) => {
  try {
    const { shop, return_url } = req.query

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Find shop record
    let shopData = await Shop.findOne({ shopify_domain: shop })

    if (!shopData) {
      return res.status(404).json({
        error: 'Shop not found. Please install the Aladdyn app first.'
      })
    }

    // Generate Customer Account API credentials if not already set
    if (!shopData.customer_account_client_id || !shopData.customer_account_client_secret) {
      // Generate mock credentials (in production, these would come from Shopify Partner Dashboard)
      shopData.customer_account_client_id = `customer_account_${shop.replace('.myshopify.com', '')}_${Date.now()}`
      shopData.customer_account_client_secret = `secret_${Math.random().toString(36).substring(2, 15)}`

      await shopData.save()
      console.log(`Generated Customer Account API credentials for ${shop}`)
    }

    // Redirect to store login page with return URL
    const storeLoginUrl = `https://${shop}/account/login?return_url=${encodeURIComponent(`${req.protocol}://${req.get('host')}/api/store-login/success?return_url=${encodeURIComponent(return_url || 'http://localhost:3000')}&shop=${shop}`)}`

    res.redirect(storeLoginUrl)
  } catch (error) {
    console.error('Store login callback error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Store login success callback
app.get('/api/store-login/success', async (req, res) => {
  try {
    const { shop, return_url } = req.query

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Redirect back to original website with success parameter
    const redirectUrl = new URL(return_url || 'http://localhost:3000')
    redirectUrl.searchParams.set('logged_in', 'true')
    redirectUrl.searchParams.set('shop', shop)

    res.redirect(redirectUrl.toString())
  } catch (error) {
    console.error('Store login success error:', error)
    res.status(500).json({ error: error.message })
  }
})

// Customer Account API routes
app.post('/api/customer-account/config', async (req, res) => {
  try {
    const { shop } = req.body

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Fetch shop configuration from database
    const shopData = await Shop.findOne({ shopify_domain: shop })

    if (!shopData) {
      return res.status(404).json({
        error: 'Shop not found. Please install the Aladdyn app first.'
      })
    }

    if (!shopData.customer_account_client_id) {
      return res.status(500).json({
        error: 'Customer Account API not configured for this shop. Please contact support.'
      })
    }

    res.json({
      success: true,
      clientId: shopData.customer_account_client_id,
      apiEndpoint: `https://${shop}/customer/api`
    })
  } catch (error) {
    console.error('Customer Account config error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/customer-account/token', async (req, res) => {
  try {
    const { code, codeVerifier, shop } = req.body

    if (!code || !codeVerifier || !shop) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Fetch shop configuration from database
    const shopData = await Shop.findOne({ shopify_domain: shop })

    if (!shopData) {
      return res.status(404).json({
        error: 'Shop not found. Please install the Aladdyn app first.'
      })
    }

    if (!shopData.customer_account_client_id || !shopData.customer_account_client_secret) {
      return res.status(500).json({
        error: 'Customer Account API not configured for this shop. Please contact support.'
      })
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://${shop}/customer/api/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: shopData.customer_account_client_id,
        client_secret: shopData.customer_account_client_secret,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: `${req.protocol}://${req.get('host')}/api/customer-account/callback`
      })
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.access_token) {
      // Fetch customer info using the access token
      const customerResponse = await fetch(`https://${shop}/customer/api/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify({
          query: `
            query {
              customer {
                id
                email
                firstName
                lastName
              }
            }
          `
        })
      })

      const customerData = await customerResponse.json()

      res.json({
        success: true,
        accessToken: tokenData.access_token,
        customer: customerData.data?.customer
      })
    } else {
      res.status(400).json({ error: 'Failed to obtain access token' })
    }
  } catch (error) {
    console.error('Customer Account token error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/customer-account/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query

    if (error) {
      return res.redirect(`${req.protocol}://${req.get('host')}?error=${encodeURIComponent(error)}`)
    }

    if (!code) {
      return res.redirect(`${req.protocol}://${req.get('host')}?error=missing_code`)
    }

    // Redirect back to the main page with the authorization code
    res.redirect(`${req.protocol}://${req.get('host')}?code=${code}&state=${state}`)
  } catch (error) {
    console.error('Customer Account callback error:', error)
    res.redirect(`${req.protocol}://${req.get('host')}?error=${encodeURIComponent(error.message)}`)
  }
})

app.post('/api/customer-account/orders', async (req, res) => {
  try {
    const { shop, customerAccessToken } = req.body

    if (!shop || !customerAccessToken) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Query customer orders using Customer Account API
    const response = await fetch(`https://${shop}/customer/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${customerAccessToken}`
      },
      body: JSON.stringify({
        query: `
          query {
            customer {
              orders(first: 10) {
                edges {
                  node {
                    id
                    orderNumber
                    processedAt
                    totalPrice {
                      amount
                      currencyCode
                    }
                    fulfillmentStatus
                    lineItems(first: 5) {
                      edges {
                        node {
                          title
                          quantity
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `
      })
    })

    if (!response.ok) {
      console.error('Customer Account API error:', response.status, response.statusText)
      return res.status(400).json({
        error: 'Failed to fetch customer orders. Please check your authentication.'
      })
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Customer Account API returned non-JSON response:', contentType)
      return res.status(400).json({
        error: 'Invalid response from customer account API. Please try again.'
      })
    }

    const data = await response.json()

    if (data.data?.customer?.orders?.edges) {
      const orders = data.data.customer.orders.edges.map(edge => edge.node)
      res.json({
        success: true,
        orders: orders
      })
    } else {
      res.json({
        success: true,
        orders: []
      })
    }
  } catch (error) {
    console.error('Customer orders error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/customer-account/cart', async (req, res) => {
  try {
    const { shop, customerAccessToken } = req.body

    if (!shop || !customerAccessToken) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Fetch shop configuration from database
    const shopData = await Shop.findOne({ shopify_domain: shop })

    if (!shopData) {
      return res.status(404).json({
        error: 'Shop not found. Please install the Aladdyn app first.'
      })
    }

    if (!shopData.storefront_access_token) {
      return res.status(500).json({
        error: 'Storefront API not configured for this shop. Please contact support.'
      })
    }

    // Query customer's personal cart using Storefront API with customer access token
    const response = await fetch(`https://${shop}/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': shopData.storefront_access_token
      },
      body: JSON.stringify({
        query: `
          query {
            customer(customerAccessToken: "${customerAccessToken}") {
              id
              email
            }
          }
        `
      })
    })

    const data = await response.json()

    // For now, return a mock cart response
    // In production, you would query the customer's actual cart
    res.json({
      success: true,
      cart: {
        id: 'customer_cart_id',
        totalQuantity: 0,
        lines: { edges: [] },
        cost: { totalAmount: { amount: '0.00', currencyCode: 'USD' } }
      }
    })
  } catch (error) {
    console.error('Customer cart error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/customer-account/checkout', async (req, res) => {
  try {
    const { shop, customerAccessToken } = req.body

    if (!shop || !customerAccessToken) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Create checkout URL for customer
    // In production, you would create an actual checkout session
    const checkoutUrl = `https://${shop}/checkout`

    res.json({
      success: true,
      checkoutUrl: checkoutUrl
    })
  } catch (error) {
    console.error('Customer checkout error:', error)
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



// Storefront MCP API endpoints
app.post('/api/storefront/products', async (req, res) => {
  try {
    const { shop, query, first = 20 } = req.body

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Use existing Admin API to fetch products
    let url = `https://${shop}/admin/api/2025-07/products.json?limit=${first}`
    if (query) {
      url += `&title=${encodeURIComponent(query)}`
    }

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }

    const data = await response.json()

    // Transform Admin API response to match Storefront format
    const transformedData = {
      data: {
        products: {
          edges: data.products.map(product => ({
            node: {
              id: product.id,
              title: product.title,
              handle: product.handle,
              description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '') : '',
              descriptionHtml: product.body_html,
              vendor: product.vendor,
              productType: product.product_type,
              tags: product.tags.split(',').map(tag => tag.trim()),
              availableForSale: product.status === 'active',
              priceRange: {
                minVariantPrice: {
                  amount: product.variants[0]?.price || '0.00',
                  currencyCode: 'USD'
                },
                maxVariantPrice: {
                  amount: product.variants[0]?.price || '0.00',
                  currencyCode: 'USD'
                }
              },
              featuredImage: product.image ? {
                url: product.image.src,
                altText: product.image.alt
              } : null,
              variants: {
                edges: product.variants.map(variant => ({
                  node: {
                    id: variant.id,
                    title: variant.title,
                    price: {
                      amount: variant.price,
                      currencyCode: 'USD'
                    },
                    availableForSale: variant.inventory_quantity > 0,
                    quantityAvailable: variant.inventory_quantity,
                    selectedOptions: variant.option1 ? [
                      { name: 'Option 1', value: variant.option1 },
                      ...(variant.option2 ? [{ name: 'Option 2', value: variant.option2 }] : []),
                      ...(variant.option3 ? [{ name: 'Option 3', value: variant.option3 }] : [])
                    ] : []
                  }
                }))
              }
            }
          }))
        }
      }
    }

    res.json(transformedData)
  } catch (error) {
    console.error('Products fetch error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/storefront/product', async (req, res) => {
  try {
    const { shop, handle, id } = req.body

    if (!shop || (!handle && !id)) {
      return res.status(400).json({ error: 'Shop domain and product handle or ID required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Build GraphQL query for single product
    const graphqlQuery = `
      query getProduct($handle: String, $id: ID) {
        product(handle: $handle, id: $id) {
          id
          title
          handle
          description
          descriptionHtml
          vendor
          productType
          tags
          availableForSale
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
            altText
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                availableForSale
                quantityAvailable
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
          }
          options {
            id
            name
            values
          }
        }
      }
    `

    const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { handle, id }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch product')
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Product fetch error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/storefront/cart/create', async (req, res) => {
  try {
    const { shop, lines = [] } = req.body

    if (!shop) {
      return res.status(400).json({ error: 'Shop domain required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Build GraphQL mutation for cart creation
    const graphqlMutation = `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            lines(first: 50) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlMutation,
        variables: { input: { lines } }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create cart')
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Cart creation error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/storefront/cart/add-lines', async (req, res) => {
  try {
    const { shop, cartId, lines } = req.body

    if (!shop || !cartId || !lines) {
      return res.status(400).json({ error: 'Shop domain, cart ID, and lines required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Build GraphQL mutation for adding lines to cart
    const graphqlMutation = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            lines(first: 50) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlMutation,
        variables: { cartId, lines }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to add lines to cart')
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Cart add lines error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/storefront/cart/update-lines', async (req, res) => {
  try {
    const { shop, cartId, lines } = req.body

    if (!shop || !cartId || !lines) {
      return res.status(400).json({ error: 'Shop domain, cart ID, and lines required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Build GraphQL mutation for updating cart lines
    const graphqlMutation = `
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id
            checkoutUrl
            totalQuantity
            cost {
              subtotalAmount {
                amount
                currencyCode
              }
              totalAmount {
                amount
                currencyCode
              }
            }
            lines(first: 50) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                      product {
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlMutation,
        variables: { cartId, lines }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update cart lines')
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Cart update lines error:', error)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/storefront/cart', async (req, res) => {
  try {
    const { shop, cartId } = req.body

    if (!shop || !cartId) {
      return res.status(400).json({ error: 'Shop domain and cart ID required' })
    }

    // Get access token from database
    const shopRecord = await Shop.findOne({ shopify_domain: shop })
    if (!shopRecord) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    // Build GraphQL query for cart
    const graphqlQuery = `
      query getCart($id: ID!) {
        cart(id: $id) {
          id
          checkoutUrl
          totalQuantity
          cost {
            subtotalAmount {
              amount
              currencyCode
            }
            totalAmount {
              amount
              currencyCode
            }
          }
          lines(first: 50) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                    product {
                      title
                      handle
                      featuredImage {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `

    const response = await fetch(`https://${shop}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopRecord.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { id: cartId }
      })
    })

    if (!response.ok) {
      throw new Error('Failed to fetch cart')
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('Cart fetch error:', error)
    res.status(500).json({ error: error.message })
  }
})

// OpenAI GPT-4o-mini integration for parsing user queries
app.post('/api/chat/parse', async (req, res) => {
  try {
    const { message, shop, customerEmail } = req.body

    if (!message || !shop) {
      return res.status(400).json({ error: 'Message and shop required' })
    }

    // Call OpenAI GPT-4o-mini to parse the user query
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant for a Shopify store. Parse user queries and determine the appropriate action:

1. PRODUCT_QUERY - User is asking about products (search, details, availability, or general listing)
2. CART_ADD - User wants to add items to cart
3. CART_UPDATE - User wants to update cart quantities
4. CART_REMOVE - User wants to remove items from cart
5. CART_VIEW - User wants to see cart contents
6. RETURN_POLICY - User is asking about return policy
7. CUSTOMER_ORDERS - User wants to see their order history
8. PERSONAL_CART - User wants to see their personal cart (different from regular cart)
9. CHECKOUT - User wants to proceed to checkout
10. GENERAL_QUESTION - General questions about the store

For PRODUCT_QUERY:
- If user asks "what products do you have", "show me products", "what's in your store" → set productQuery to "all"
- If user asks for specific products like "shirts", "snowboards" → set productQuery to the specific term
- If user asks about a specific product by name → set productHandle to the product name

For CART_ADD:
- If user says "add [product] to cart" → set productQuery to the product name
- If user specifies a variant like "add $10 gift card" → set productQuery to "gift card" and variantId to the specific variant
- If user specifies quantity like "add 2 snowboards" → set quantity to 2
- IMPORTANT: Extract variant information from the message (e.g., "$10", "$25", "option 1", etc.)

For CUSTOMER_ORDERS:
- If user asks "my orders", "order history", "past orders", "what did I buy" → use CUSTOMER_ORDERS action

For PERSONAL_CART:
- If user asks "my cart", "personal cart", "my saved cart" → use PERSONAL_CART action

For CHECKOUT:
- If user says "checkout", "buy now", "proceed to payment" → use CHECKOUT action

Respond with JSON format:
{
  "action": "ACTION_TYPE",
  "parameters": {
    "productQuery": "search term if applicable, or 'all' for general listing",
    "productHandle": "product handle if specified",
    "variantId": "variant ID if specified",
    "variantTitle": "variant title if specified (e.g., '$10', '$25')",
    "quantity": "quantity if specified",
    "cartId": "cart ID if available"
  },
  "response": "helpful response message"
}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!openaiResponse.ok) {
      throw new Error('OpenAI API call failed')
    }

    const openaiData = await openaiResponse.json()
    const parsedResponse = JSON.parse(openaiData.choices[0].message.content)

    res.json(parsedResponse)
  } catch (error) {
    console.error('Chat parse error:', error)
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