import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ScriptPage = () => {
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(true)
  const [shopDomain, setShopDomain] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const generateScript = async () => {
      try {
        const domain = localStorage.getItem('shop_domain')
        if (!domain) {
          navigate('/login')
          return
        }
        
        setShopDomain(domain)
        
        const response = await fetch('/api/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shop: domain })
        })
        
        const result = await response.json()
        if (result.success) {
          setScript(result.script)
        } else {
          throw new Error(result.error || 'Failed to generate script')
        }
      } catch (error) {
        console.error('Script generation error:', error)
        setScript('// Error generating script')
      } finally {
        setLoading(false)
      }
    }

    generateScript()
  }, [navigate])

  const copyScript = () => {
    navigator.clipboard.writeText(script)
    alert('Script copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Generating your chatbot script...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-700">Chatbot Script</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Your Chatbot Script</h2>
            <p className="text-slate-600">Copy this script and add it to any website to embed the chatbot.</p>
            <p className="text-sm text-slate-500 mt-2">Store: <span className="font-medium">{shopDomain}</span></p>
            <p className="text-xs text-green-600 mt-1">✓ Only one script per shop - this is your unique chatbot</p>
          </div>

          <div className="bg-slate-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-slate-800">Script Code</h3>
              <button
                onClick={copyScript}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
              >
                Copy Script
              </button>
            </div>
            <pre className="text-sm text-slate-700 overflow-x-auto whitespace-pre-wrap bg-white p-3 rounded border">
              {script}
            </pre>
          </div>

          <div className="text-sm text-slate-600">
            <h4 className="font-medium mb-2">How to use:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Copy the script above</li>
              <li>Paste it before the closing &lt;/body&gt; tag of any website</li>
              <li>A purple chat button will appear in the bottom-right corner</li>
              <li>Visitors can click it to open the chatbot</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScriptPage