import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const GenieGenerate = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const shopDomain = localStorage.getItem('shop_domain')
      const response = await fetch('/api/genie/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopDomain })
      })

      if (response.ok) {
        navigate('/genie/view')
      } else {
        const error = await response.json()
        alert(error.error)
      }
    } catch (error) {
      alert('Failed to generate script')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-800 mb-4">Generate Genie Script</h1>
        <p className="text-slate-600 mb-6">
          Create a unique script for your store. This can only be done once.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-3 px-4 rounded-lg"
        >
          {loading ? 'Generating...' : 'Generate Script'}
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full mt-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

export default GenieGenerate