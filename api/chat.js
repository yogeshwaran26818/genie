import mongoose from 'mongoose'
import Shop from '../src/models/Shop.js'

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    }

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    await connectDB()
    const { message, shop } = req.body
    
    if (!message || !shop) {
      return res.status(400).json({ success: false, error: 'Message and shop required' })
    }

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

    // Simple response for now
    res.json({ success: true, response: 'Hello! I can help you with product information.' })
  } catch (error) {
    console.error('Chat error:', error)
    res.json({ success: true, response: 'I\'m here to help! You can ask me about our products and prices.' })
  }
}