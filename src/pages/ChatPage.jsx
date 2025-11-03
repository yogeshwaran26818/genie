import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const ChatPage = () => {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [shopDomain, setShopDomain] = useState('')
    const [customerEmail, setCustomerEmail] = useState(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const messagesEndRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        const domain = localStorage.getItem('shop_domain')
        if (!domain) {
            navigate('/login')
            return
        }
        setShopDomain(domain)

        // Check URL parameters for successful login
        const urlParams = new URLSearchParams(window.location.search)
        const loggedIn = urlParams.get('logged_in')
        const email = urlParams.get('email')

        if (loggedIn === 'true' && email) {
            setCustomerEmail(email)
            setIsAuthenticated(true)
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname)

            // Add success message
            setMessages([{
                id: Date.now(),
                text: `✅ Successfully logged in as ${email}! Now I can help you with your cart and orders.`,
                sender: 'bot'
            }])
        } else {
            // Add welcome message
            setMessages([{
                id: Date.now(),
                text: "Hello! I'm Genie, your AI assistant. I can help you with information about your store, products, orders, and customers. What would you like to know?",
                sender: 'bot'
            }])
        }
    }, [navigate])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async (e) => {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMessage = {
            id: Date.now(),
            text: input.trim(),
            sender: 'user'
        }

        setMessages(prev => [...prev, userMessage])
        setInput('')
        setLoading(true)

        try {
            const response = await fetch('/api/chat/genie', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage.text,
                    shop: shopDomain,
                    customerEmail: customerEmail
                }),
            })

            const data = await response.json()

            // If authentication is required, show login button
            if (data.requiresAuth && !isAuthenticated) {
                const botMessage = {
                    id: Date.now() + 1,
                    text: data.response,
                    sender: 'bot',
                    requiresAuth: true,
                    loginUrl: data.loginUrl
                }
                setMessages(prev => [...prev, botMessage])
            } else {
                const botMessage = {
                    id: Date.now() + 1,
                    text: data.response || "I'm sorry, I couldn't process that request.",
                    sender: 'bot'
                }
                setMessages(prev => [...prev, botMessage])
            }
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage = {
                id: Date.now() + 1,
                text: "I'm having trouble connecting. Please try again.",
                sender: 'bot'
            }
            setMessages(prev => [...prev, errorMessage])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xl">✨</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-purple-700">Chat with Genie</h1>
                            <p className="text-xs text-slate-500">
                                {isAuthenticated ? `✅ Logged in as ${customerEmail}` : 'Your AI assistant'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-lg px-4 py-3 ${message.sender === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                    }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                {message.requiresAuth && message.loginUrl && (
                                    <button
                                        onClick={() => {
                                            // Open login in new window so user can see success message
                                            window.open(message.loginUrl, '_blank', 'width=600,height=700')
                                        }}
                                        className="mt-3 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors w-full"
                                    >
                                        Please Sign-In
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white text-slate-800 shadow-sm border border-slate-200 rounded-lg px-4 py-3">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <form onSubmit={handleSend} className="flex space-x-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask me anything about your store..."
                            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
                        >
                            Send
                        </button>
                    </form>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                        Examples: "What products do I have?", "Show me recent orders", "How many customers are there?"
                    </p>
                </div>
            </div>
        </div>
    )
}

export default ChatPage

