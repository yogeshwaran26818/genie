import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import GenieGenerate from './pages/GenieGenerate'
import GenieView from './pages/GenieView'
import AladdynChatbot from './components/AladdynChatbot'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/shopify/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/genie/generate" element={<GenieGenerate />} />
        <Route path="/genie/view" element={<GenieView />} />
      </Routes>

      {/* Enhanced chatbot with flexible authentication */}
      <AladdynChatbot
        shopDomain="testing-aladyyn.myshopify.com"
        authMode="hybrid" // 'guest', 'email', 'social', 'custom', 'hybrid'
        enableGuestMode={true}
        socialProviders={['google', 'facebook']}
        apiBaseUrl="/api"
        onAuthSuccess={(authData) => {
          console.log('User authenticated:', authData)
          // Handle successful authentication
        }}
        onAuthError={(error) => {
          console.error('Authentication failed:', error)
          // Handle authentication errors
        }}
      />
    </Router>
  )
}

export default App