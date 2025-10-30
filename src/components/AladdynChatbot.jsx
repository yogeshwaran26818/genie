import React, { useState, useEffect, useRef } from 'react'

const AladdynChatbot = ({
    shopDomain = 'testing-aladyyn.myshopify.com',
    authMode = 'email', // 'guest', 'email', 'social', 'custom', 'hybrid'
    customAuthData = null, // For custom auth integration
    onAuthSuccess = null, // Callback when auth succeeds
    onAuthError = null,   // Callback when auth fails
    enableGuestMode = true, // Allow guest browsing
    socialProviders = ['google', 'facebook'], // Available social logins
    apiBaseUrl = '/api' // API base URL for external websites
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([])
    const [authState, setAuthState] = useState({
        isAuthenticated: false,
        user: null,
        authMethod: null,
        awaitingAuth: false,
        isGuest: false
    })
    const [inputValue, setInputValue] = useState('')
    const [currentCartId, setCurrentCartId] = useState(null)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        initializeAuth()
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const initializeAuth = () => {
        // Check if custom auth data is provided
        if (authMode === 'custom' && customAuthData) {
            handleCustomAuth(customAuthData)
            return
        }

        // Check for existing session
        const savedAuth = localStorage.getItem(`aladdyn_auth_${shopDomain}`)
        if (savedAuth) {
            try {
                const authData = JSON.parse(savedAuth)
                setAuthState({
                    isAuthenticated: true,
                    user: authData.user,
                    authMethod: authData.method,
                    awaitingAuth: false,
                    isGuest: authData.method === 'guest'
                })
                addMessage(`Welcome back, ${authData.user.name || authData.user.email}! How can I help you today?`, 'bot')
                return
            } catch (error) {
                console.error('Failed to parse saved auth:', error)
                localStorage.removeItem(`aladdyn_auth_${shopDomain}`)
            }
        }

        // Start authentication flow based on mode
        if (authMode === 'guest' || enableGuestMode) {
            startGuestMode()
        } else {
            startAuthFlow()
        }
    }

    const startGuestMode = () => {
        setAuthState({
            isAuthenticated: true,
            user: { name: 'Guest User', email: null, isGuest: true },
            authMethod: 'guest',
            awaitingAuth: false,
            isGuest: true
        })
        addMessage('Welcome! You\'re browsing as a guest. You can explore products and add items to cart. Sign in for full features!', 'bot')
    }

    const startAuthFlow = () => {
        setAuthState(prev => ({ ...prev, awaitingAuth: true }))

        if (authMode === 'email') {
            addMessage('Hello! Please enter your registered email to continue.', 'bot')
        } else if (authMode === 'social') {
            showSocialLoginOptions()
        } else if (authMode === 'hybrid') {
            showAuthOptions()
        }
    }

    const showAuthOptions = () => {
        const message = `Welcome! Choose how you'd like to continue:\n\n` +
            `1. **Continue as Guest** - Browse products without signing in\n` +
            `2. **Sign in with Email** - Full access to your account\n` +
            `3. **Social Login** - Quick sign in with Google/Facebook\n\n` +
            `Type your choice (1, 2, or 3) or "guest", "email", "social"`

        addMessage(message, 'bot')
    }

    const showSocialLoginOptions = () => {
        let message = `Sign in with your social account:\n\n`
        socialProviders.forEach((provider, index) => {
            message += `${index + 1}. **${provider.charAt(0).toUpperCase() + provider.slice(1)}**\n`
        })
        message += `\nType the provider name or number to continue`

        addMessage(message, 'bot')
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const addMessage = (text, sender) => {
        setMessages(prev => [...prev, { text, sender, id: Date.now() }])
    }

    const sendMessage = async (message) => {
        addMessage(message, 'user')
        setInputValue('')

        if (authState.awaitingAuth) {
            await handleAuthInput(message)
        } else {
            await handleChatMessage(message)
        }
    }

    const handleAuthInput = async (input) => {
        const lowerInput = input.toLowerCase().trim()

        if (authMode === 'email') {
            await verifyEmail(input)
        } else if (authMode === 'social') {
            await handleSocialAuth(input)
        } else if (authMode === 'hybrid') {
            await handleHybridAuth(input)
        }
    }

    const handleHybridAuth = async (input) => {
        const lowerInput = input.toLowerCase().trim()

        if (lowerInput.includes('guest') || lowerInput === '1') {
            startGuestMode()
        } else if (lowerInput.includes('email') || lowerInput === '2') {
            setAuthState(prev => ({ ...prev, awaitingAuth: true }))
            addMessage('Please enter your registered email:', 'bot')
        } else if (lowerInput.includes('social') || lowerInput === '3') {
            showSocialLoginOptions()
        } else {
            addMessage('Please choose an option: "guest", "email", or "social"', 'bot')
        }
    }

    const handleSocialAuth = async (provider) => {
        const lowerProvider = provider.toLowerCase().trim()

        if (socialProviders.includes(lowerProvider)) {
            addMessage(`Redirecting to ${lowerProvider} login...`, 'bot')
            // Implement social login logic here
            // For now, simulate success
            setTimeout(() => {
                handleAuthSuccess({
                    name: 'Social User',
                    email: 'user@example.com',
                    provider: lowerProvider
                }, 'social')
            }, 1000)
        } else {
            addMessage(`Please choose from: ${socialProviders.join(', ')}`, 'bot')
        }
    }

    const verifyEmail = async (email) => {
        addMessage('Verifying your email...', 'bot')

        try {
            console.log('Attempting to verify email:', email, 'for shop:', shopDomain)
            const response = await fetch(`${apiBaseUrl}/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    shop: shopDomain
                })
            })

            console.log('Response status:', response.status)
            const result = await response.json()
            console.log('Response data:', result)

            if (result.verified) {
                handleAuthSuccess({
                    name: result.customer?.name || email,
                    email: email,
                    id: result.customer?.id
                }, 'email')
            } else {
                addMessage('Email not found. Would you like to continue as a guest or try a different email?', 'bot')
                if (enableGuestMode) {
                    addMessage('Type "guest" to continue without signing in.', 'bot')
                }
            }
        } catch (error) {
            console.error('Email verification error:', error)
            addMessage(`Verification failed: ${error.message}. Please try again or type "guest" to continue.`, 'bot')
            if (onAuthError) onAuthError(error)
        }
    }

    const handleCustomAuth = (authData) => {
        handleAuthSuccess(authData, 'custom')
    }

    const handleAuthSuccess = (userData, method) => {
        const authData = {
            user: userData,
            method: method,
            timestamp: Date.now()
        }

        setAuthState({
            isAuthenticated: true,
            user: userData,
            authMethod: method,
            awaitingAuth: false,
            isGuest: method === 'guest'
        })

        // Save to localStorage for persistence
        localStorage.setItem(`aladdyn_auth_${shopDomain}`, JSON.stringify(authData))

        // Call success callback
        if (onAuthSuccess) onAuthSuccess(authData)

        // Welcome message
        const welcomeMsg = method === 'guest'
            ? 'Welcome! You\'re browsing as a guest. How can I help you today?'
            : `Welcome back, ${userData.name || userData.email}! How can I assist you today?`

        addMessage(welcomeMsg, 'bot')
    }

    const handleChatMessage = async (message) => {
        try {
            // Parse the user message using OpenAI GPT-4o-mini
            const parseResponse = await fetch(`${apiBaseUrl}/chat/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    shop: shopDomain,
                    customerEmail: authState.user?.email,
                    authMethod: authState.authMethod,
                    isGuest: authState.isGuest
                })
            })

            const parsedData = await parseResponse.json()
            const { action, parameters, response } = parsedData

            // Handle different actions
            switch (action) {
                case 'PRODUCT_QUERY':
                    await handleProductQuery(parameters)
                    break
                case 'CART_ADD':
                    await handleCartAdd(parameters)
                    break
                case 'CART_UPDATE':
                    await handleCartUpdate(parameters)
                    break
                case 'CART_VIEW':
                    await handleCartView(parameters)
                    break
                case 'RETURN_POLICY':
                    await handleReturnPolicy()
                    break
                case 'AUTH_REQUEST':
                    handleAuthRequest()
                    break
                default:
                    addMessage(response || 'I\'m here to help! You can ask me about products, add items to cart, or ask about our return policy.', 'bot')
            }
        } catch (error) {
            console.error('Chat message handling error:', error)
            addMessage('I\'m sorry, I encountered an error. Please try again.', 'bot')
        }
    }

    const handleAuthRequest = () => {
        if (authState.isGuest) {
            addMessage('To access full features, please sign in. Type "sign in" to continue.', 'bot')
        } else {
            addMessage('You\'re already signed in! How can I help you?', 'bot')
        }
    }

    const handleProductQuery = async (parameters) => {
        try {
            const { productQuery, productHandle } = parameters

            if (productHandle) {
                // Get specific product
                const response = await fetch(`${apiBaseUrl}/storefront/product`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: shopDomain,
                        handle: productHandle
                    })
                })
                const data = await response.json()

                if (data.data?.product) {
                    const product = data.data.product
                    const message = `**${product.title}**\n\n${product.description}\n\nPrice: $${product.priceRange.minVariantPrice.amount} - $${product.priceRange.maxVariantPrice.amount}\n\nAvailable: ${product.availableForSale ? 'Yes' : 'No'}\n\n${product.variants.edges.length > 0 ? `Variants: ${product.variants.edges.length} options available` : ''}`
                    addMessage(message, 'bot')
                } else {
                    addMessage('Product not found. Please try a different search term.', 'bot')
                }
            } else {
                // Search products or list all products
                const searchQuery = productQuery === 'all'
                    ? null
                    : productQuery && !productQuery.toLowerCase().includes('store') && !productQuery.toLowerCase().includes('products')
                        ? productQuery
                        : null

                const response = await fetch(`${apiBaseUrl}/storefront/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: shopDomain,
                        query: searchQuery,
                        first: 10
                    })
                })
                const data = await response.json()

                if (data.data?.products?.edges?.length > 0) {
                    const products = data.data.products.edges.map(edge => edge.node)
                    let message = `Here are the products in our store:\n\n`
                    products.forEach(product => {
                        message += `• **${product.title}** - $${product.priceRange.minVariantPrice.amount}\n`
                        if (product.description) {
                            message += `  ${product.description.substring(0, 100)}...\n`
                        }
                        message += `  Available: ${product.availableForSale ? 'Yes' : 'No'}\n\n`
                    })
                    addMessage(message, 'bot')
                } else {
                    addMessage('No products found. Please try a different search term.', 'bot')
                }
            }
        } catch (error) {
            console.error('Product query error:', error)
            addMessage('Sorry, I couldn\'t search for products right now. Please try again.', 'bot')
        }
    }

    const handleCartAdd = async (parameters) => {
        try {
            const { variantId, quantity = 1, productQuery, variantTitle } = parameters

            // If no variantId is provided, we need to get the product first
            if (!variantId && productQuery) {
                // Get product details to show variants
                const response = await fetch(`${apiBaseUrl}/storefront/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: shopDomain,
                        query: productQuery,
                        first: 1
                    })
                })
                const data = await response.json()

                if (data.data?.products?.edges?.length > 0) {
                    const product = data.data.products.edges[0].node

                    // If variantTitle is provided, try to find matching variant
                    if (variantTitle) {
                        const matchingVariant = product.variants.edges.find(edge =>
                            edge.node.title.toLowerCase().includes(variantTitle.toLowerCase()) ||
                            variantTitle.toLowerCase().includes(edge.node.title.toLowerCase())
                        )

                        if (matchingVariant) {
                            await addToCart(matchingVariant.node.id, quantity)
                            return
                        }
                    }

                    if (product.variants.edges.length > 1) {
                        // Product has multiple variants, ask user to choose
                        let message = `**${product.title}** has multiple options:\n\n`
                        product.variants.edges.forEach((variantEdge, index) => {
                            const variant = variantEdge.node
                            message += `${index + 1}. **${variant.title}** - $${variant.price.amount}\n`
                        })
                        message += `\nPlease specify which option you'd like (e.g., "add $10 gift card" or "add option 1")`
                        addMessage(message, 'bot')
                        return
                    } else if (product.variants.edges.length === 1) {
                        // Product has only one variant, use it
                        const variant = product.variants.edges[0].node
                        await addToCart(variant.id, quantity)
                        return
                    }
                } else {
                    addMessage('Product not found. Please try a different product name.', 'bot')
                    return
                }
            }

            if (!variantId) {
                addMessage('Please specify which product variant you\'d like to add to cart.', 'bot')
                return
            }

            await addToCart(variantId, quantity)
        } catch (error) {
            console.error('Cart add error:', error)
            addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot')
        }
    }

    const addToCart = async (variantId, quantity) => {
        try {
            const lines = [{
                merchandiseId: variantId,
                quantity: parseInt(quantity)
            }]

            let response
            if (currentCartId) {
                // Add to existing cart
                response = await fetch(`${apiBaseUrl}/storefront/cart/add-lines`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: shopDomain,
                        cartId: currentCartId,
                        lines
                    })
                })
            } else {
                // Create new cart
                response = await fetch(`${apiBaseUrl}/storefront/cart/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: shopDomain,
                        lines
                    })
                })
            }

            const data = await response.json()

            if (data.data?.cartCreate?.cart || data.data?.cartLinesAdd?.cart) {
                const cart = data.data.cartCreate?.cart || data.data.cartLinesAdd.cart
                setCurrentCartId(cart.id)
                addMessage(`✅ Added ${quantity} item(s) to your cart! Total items: ${cart.totalQuantity}`, 'bot')
            } else {
                addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot')
            }
        } catch (error) {
            console.error('Add to cart error:', error)
            addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot')
        }
    }

    const handleCartUpdate = async (parameters) => {
        try {
            const { variantId, quantity } = parameters

            if (!currentCartId) {
                addMessage('You don\'t have any items in your cart yet.', 'bot')
                return
            }

            if (!variantId || !quantity) {
                addMessage('Please specify which item and quantity to update.', 'bot')
                return
            }

            const lines = [{
                id: variantId,
                quantity: parseInt(quantity)
            }]

            const response = await fetch(`${apiBaseUrl}/storefront/cart/update-lines`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop: shopDomain,
                    cartId: currentCartId,
                    lines
                })
            })

            const data = await response.json()

            if (data.data?.cartLinesUpdate?.cart) {
                const cart = data.data.cartLinesUpdate.cart
                addMessage(`✅ Updated cart! Total items: ${cart.totalQuantity}`, 'bot')
            } else {
                addMessage('Sorry, I couldn\'t update your cart. Please try again.', 'bot')
            }
        } catch (error) {
            console.error('Cart update error:', error)
            addMessage('Sorry, I couldn\'t update your cart. Please try again.', 'bot')
        }
    }

    const handleCartView = async (parameters) => {
        try {
            if (!currentCartId) {
                addMessage('Your cart is empty. You can add items by asking me about products!', 'bot')
                return
            }

            const response = await fetch(`${apiBaseUrl}/storefront/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop: shopDomain,
                    cartId: currentCartId
                })
            })

            const data = await response.json()

            if (data.data?.cart) {
                const cart = data.data.cart
                let message = `**Your Cart** (${cart.totalQuantity} items)\n\n`

                if (cart.lines.edges.length > 0) {
                    cart.lines.edges.forEach(edge => {
                        const line = edge.node
                        message += `• ${line.merchandise.product.title} (${line.quantity}x) - $${line.merchandise.price.amount}\n`
                    })
                    message += `\n**Total: $${cart.cost.totalAmount.amount}**`
                } else {
                    message = 'Your cart is empty.'
                }

                addMessage(message, 'bot')
            } else {
                addMessage('Sorry, I couldn\'t retrieve your cart. Please try again.', 'bot')
            }
        } catch (error) {
            console.error('Cart view error:', error)
            addMessage('Sorry, I couldn\'t retrieve your cart. Please try again.', 'bot')
        }
    }

    const handleReturnPolicy = async () => {
        addMessage(`**Return Policy**\n\nWe offer a 30-day return policy for most items. Items must be in original condition with tags attached.\n\n• Electronics: 14-day return window\n• Clothing: 30-day return window\n• Sale items: Final sale, no returns\n\nFor returns, please contact our customer service team.`, 'bot')
    }

    const createChatbot = () => {
        const chatWidget = document.createElement('div')
        chatWidget.id = 'aladdyn-chatbot'
        chatWidget.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
        <div id="chat-toggle" style="width: 60px; height: 60px; background: #7c3aed; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <span style="color: white; font-size: 24px;">💬</span>
        </div>
        <div id="chat-window" style="display: none; width: 350px; height: 500px; background: white; border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); position: absolute; bottom: 70px; right: 0;">
          <div style="padding: 20px; border-bottom: 1px solid #eee; background: #7c3aed; color: white; border-radius: 10px 10px 0 0;">
            <h3 style="margin: 0; font-size: 16px;">Aladdyn Assistant</h3>
            ${authState.isGuest ? '<span style="font-size: 12px; opacity: 0.8;">Guest Mode</span>' : ''}
          </div>
          <div id="chat-messages" style="height: 350px; overflow-y: auto; padding: 15px;"></div>
          <div style="padding: 15px; border-top: 1px solid #eee;">
            <input id="chat-input" type="text" placeholder="Type your message..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; outline: none;">
          </div>
        </div>
      </div>
    `
        document.body.appendChild(chatWidget)
        bindEvents()
    }

    const bindEvents = () => {
        const toggle = document.getElementById('chat-toggle')
        const window = document.getElementById('chat-window')
        const input = document.getElementById('chat-input')

        if (toggle) {
            toggle.onclick = () => {
                window.style.display = window.style.display === 'none' ? 'block' : 'none'
                if (window.style.display === 'block') {
                    input.focus()
                }
            }
        }

        if (input) {
            input.onkeypress = (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    sendMessage(input.value.trim())
                    input.value = ''
                }
            }
        }
    }

    const renderMessages = () => {
        const messagesContainer = document.getElementById('chat-messages')
        if (!messagesContainer) return

        messagesContainer.innerHTML = messages.map(msg => `
      <div style="margin-bottom: 10px; padding: 8px 12px; border-radius: 15px; max-width: 80%; ${msg.sender === 'user'
                ? 'background: #7c3aed; color: white; margin-left: auto; text-align: right;'
                : 'background: #f1f5f9; color: #334155;'
            }">
        ${msg.text.replace(/\n/g, '<br>')}
      </div>
    `).join('')

        messagesContainer.scrollTop = messagesContainer.scrollHeight
    }

    useEffect(() => {
        renderMessages()
    }, [messages])

    useEffect(() => {
        createChatbot()
        return () => {
            const existingWidget = document.getElementById('aladdyn-chatbot')
            if (existingWidget) {
                existingWidget.remove()
            }
        }
    }, [])

    return null // This component renders directly to DOM
}

export default AladdynChatbot