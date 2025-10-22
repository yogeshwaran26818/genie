import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const GenieView = () => {
  const [genie, setGenie] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchGenie = async () => {
      try {
        const shopDomain = localStorage.getItem('shop_domain')
        const response = await fetch('/api/genie/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: shopDomain })
        })

        const data = await response.json()
        if (data.exists) {
          setGenie(data.genie)
        } else {
          navigate('/genie/generate')
        }
      } catch (error) {
        console.error('Error fetching genie:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchGenie()
  }, [navigate])

  const copyScript = () => {
    navigator.clipboard.writeText(genie.script_content)
    alert('Script copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Your Genie Script</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-slate-600 mb-2">Script ID: {genie?.script_id}</p>
            <p className="text-sm text-slate-600">Created: {new Date(genie?.createdAt).toLocaleDateString()}</p>
          </div>

          <div className="bg-slate-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-slate-800">Script Code</h3>
              <button
                onClick={copyScript}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
              >
                Copy
              </button>
            </div>
            <pre className="text-sm text-slate-700 overflow-x-auto whitespace-pre-wrap">
              {genie?.script_content}
            </pre>
          </div>

          <div className="text-sm text-slate-600">
            <p>• This script is unique to your store</p>
            <p>• Add it to your theme's footer or use a script tag app</p>
            <p>• The script cannot be regenerated once created</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GenieView