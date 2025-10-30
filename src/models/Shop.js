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




}, {
  timestamps: true
})

export default mongoose.model('Shop', shopSchema)