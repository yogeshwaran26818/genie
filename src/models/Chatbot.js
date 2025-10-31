import mongoose from 'mongoose'

const chatbotSchema = new mongoose.Schema({
  shopify_domain: {
    type: String,
    required: true,
    unique: true
  },
  script_id: {
    type: String,
    required: true,
    unique: true
  },
  script_content: {
    type: String,
    required: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

export default mongoose.model('Chatbot', chatbotSchema)