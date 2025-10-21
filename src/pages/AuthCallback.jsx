import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const AuthCallback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('connecting')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const shop = searchParams.get('shop')
        const success = searchParams.get('success')
        const errorParam = searchParams.get('error')

        if (errorParam) {
          throw new Error(decodeURIComponent(errorParam))
        }

        console.log('Callback params:', { shop, success, errorParam })
        
        if (success === 'true' && shop) {
          localStorage.removeItem('oauth_state')
          localStorage.setItem('shop_domain', shop)
          setStatus('success')
          setTimeout(() => {
            navigate('/dashboard')
          }, 2000)
        } else {
          throw new Error(`Connection failed - success: ${success}, shop: ${shop}`)
        }
      } catch (err) {
        setError(err.message)
        setStatus('error')
      }
    }

    handleCallback()
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-100">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            {status === 'connecting' && (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            )}
            {status === 'success' && (
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}
            {status === 'error' && (
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {status === 'connecting' && 'Connecting...'}
            {status === 'success' && 'Connected!'}
            {status === 'error' && 'Connection Failed'}
          </h2>

          <p className="text-slate-600 mb-6">
            {status === 'connecting' && 'Please wait while we connect your Shopify store...'}
            {status === 'success' && 'Successfully connected! Redirecting to dashboard...'}
            {status === 'error' && error}
          </p>

          {status === 'error' && (
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default AuthCallback