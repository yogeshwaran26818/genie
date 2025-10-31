import mongoose from 'mongoose'

const customerAuthSchema = new mongoose.Schema({
  shopify_domain: {
    type: String,
    required: true,
    unique: true
  },
  customer_account_client_id: {
    type: String,
    required: true
  },
  customer_account_client_secret: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model('CustomerAuth', customerAuthSchema)