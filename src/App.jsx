import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import GenieGenerate from './pages/GenieGenerate'
import GenieView from './pages/GenieView'

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
    </Router>
  )
}

export default App