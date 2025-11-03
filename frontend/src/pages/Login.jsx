import { useState } from 'react'

const Login = () => {
  const [storeDomain, setStoreDomain] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)

  const handleConnectShopify = () => {
    setShowPrompt(true)
  }

  const handleSubmitDomain = () => {
    if (!storeDomain) {
      alert('Please enter your store domain')
      return
    }

    // Clean domain (remove .myshopify.com if present)
    const cleanDomain = storeDomain.replace('.myshopify.com', '')
    const fullDomain = `${cleanDomain}.myshopify.com`

    // Generate state for security
    const state = Math.random().toString(36).substring(7)
    localStorage.setItem('oauth_state', state)

    // Shopify OAuth URL
    const shopifyAuthUrl = `https://${fullDomain}/admin/oauth/authorize?` +
      `client_id=${import.meta.env.VITE_SHOPIFY_API_KEY}&` +
      `scope=read_customers,read_inventory,read_orders,read_products,write_script_tags,read_script_tags,write_storefront_access_tokens&` +
      `redirect_uri=${encodeURIComponent(import.meta.env.VITE_SHOPIFY_REDIRECT_URI)}&` +
      `state=${state}`

    window.location.href = shopifyAuthUrl
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-700 mb-2">Aladdyn</h1>
          <p className="text-slate-600">Connect your Shopify store</p>
        </div>

        {!showPrompt ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.5 5.5h17v13h-17z" />
                  <path d="M3 4h18v16H3z" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Connect to Shopify
              </h2>
              <p className="text-slate-600 mb-6">
                Securely connect your Shopify store to view products, pricing, and analytics
              </p>
            </div>

            <button
              onClick={handleConnectShopify}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.8 2.1c-.8-.1-1.4.6-1.4 1.4v.2c0 .1 0 .2-.1.2-.4.2-.8.5-1.1.8-.3.3-.5.7-.6 1.1 0 .1-.1.1-.2.1h-.2c-.8 0-1.5.6-1.4 1.4l.8 11.1c.1.8.8 1.4 1.6 1.4h7.2c.8 0 1.5-.6 1.6-1.4l.8-11.1c.1-.8-.6-1.4-1.4-1.4h-.2c-.1 0-.2 0-.2-.1-.1-.4-.3-.8-.6-1.1-.3-.3-.7-.6-1.1-.8-.1 0-.1-.1-.1-.2v-.2c0-.8-.6-1.5-1.4-1.4zm-1.4 3.4c0-.1.1-.2.2-.2h2.8c.1 0 .2.1.2.2v.8c0 .1-.1.2-.2.2h-2.8c-.1 0-.2-.1-.2-.2v-.8z" />
              </svg>
              <span>Connect to Shopify</span>
            </button>

            <div className="text-center text-sm text-slate-500">
              <p>By connecting, you agree to our terms of service</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Enter Store Domain
              </h2>
              <p className="text-slate-600 mb-6">
                Enter your Shopify store domain to continue
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Store Domain
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={storeDomain}
                    onChange={(e) => setStoreDomain(e.target.value)}
                    placeholder="mystore"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-3 text-slate-500">
                    .myshopify.com
                  </span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPrompt(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmitDomain}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login