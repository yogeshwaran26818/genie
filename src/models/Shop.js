import mongoose from 'mongoose'

const shopSchema = new mongoose.Schema({
  shopify_domain: {
    type: String,
    required: true,
    unique: true
  },
  shopify_access_token: {
    type: String,
    required: true
  },
  storefront_access_token: {
    type: String,
    required: false
  },
  customer_account_client_id: {
    type: String,
    required: false
  },
  customer_account_client_secret: {
    type: String,
    required: false
  }
}, {
  timestamps: true
})

export default mongoose.model('Shop', shopSchema)