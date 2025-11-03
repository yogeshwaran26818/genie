import mongoose from 'mongoose'
import Shop from '../src/models/Shop.js'

// MongoDB connection for serverless
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
  try {
    await connectDB()
    
    const { code, shop, state } = req.query

    if (!code || !shop || !state) {
      return res.status(400).json({ error: 'Missing required parameters' })
    }

    // Exchange code for token
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

    const tokenData = await response.json()

    // Save to database
    await Shop.findOneAndUpdate(
      { shopify_domain: shop },
      {
        shopify_domain: shop,
        shopify_access_token: tokenData.access_token
      },
      { upsert: true, new: true }
    )

    // Redirect to success page
    res.redirect(`${process.env.APP_URL}/shopify/callback?shop=${shop}&success=true`)
  } catch (error) {
    console.error('Auth error:', error)
    const errorMessage = encodeURIComponent(error.message)
    res.redirect(`${process.env.APP_URL}/shopify/callback?error=${errorMessage}`)
  }
}