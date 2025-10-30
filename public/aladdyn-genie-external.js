(function () {
    console.log('Aladdyn Genie loaded for external websites');

    // Configuration object - customize these for your website
    window.AladdynGenie = {
        shopDomain: 'testing-aladyyn.myshopify.com',
        scriptId: 'genie_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),

        // Authentication Configuration
        authMode: 'hybrid', // 'guest', 'email', 'social', 'custom', 'hybrid'
        enableGuestMode: true,
        socialProviders: ['google', 'facebook', 'apple'],
        apiBaseUrl: '/api', // Change this to your API endpoint

        // Customer Account API Configuration
        customerAccountClientId: null, // Will be fetched from backend
        customerAccessToken: null,
        customerAccountApiEndpoint: null,

        // Custom authentication data (if using custom auth)
        customAuthData: null,

        // Callbacks
        onAuthSuccess: null,
        onAuthError: null,

        // State
        authState: {
            isAuthenticated: false,
            user: null,
            authMethod: null,
            awaitingAuth: false,
            isGuest: false
        },
        messages: [],
        currentCartId: null,
        awaitingEmail: false,
        customerEmail: null,
        currentProducts: null,

        init: function (config = {}) {
            console.log('Initializing AladdynGenie with config:', config);
            // Merge configuration
            Object.assign(this, config);

            console.log('Creating chatbot...');
            this.createChatbot();
            console.log('Checking return from store login...');
            this.checkReturnFromStoreLogin();
            console.log('Initializing auth...');
            this.initializeAuth();
            console.log('Fetching customer account config...');
            this.fetchCustomerAccountConfig();
            console.log('Genie chatbot initialized with auth mode:', this.authMode);
        },

        checkReturnFromStoreLogin: function () {
            // Check if user returned from store login
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = sessionStorage.getItem(`return_url_${this.shopDomain}`);

            if (returnUrl && urlParams.get('logged_in') === 'true') {
                // User successfully logged in to store
                this.handleStoreLoginSuccess();
                // Clean up URL parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                sessionStorage.removeItem(`return_url_${this.shopDomain}`);
            }
        },

        handleStoreLoginSuccess: function () {
            // Set authenticated state
            this.authState = {
                isAuthenticated: true,
                user: { name: 'Store Customer', email: null, isGuest: false },
                authMethod: 'store-login',
                awaitingAuth: false,
                isGuest: false
            };

            // Save auth state
            localStorage.setItem(`aladdyn_auth_${this.shopDomain}`, JSON.stringify({
                user: this.authState.user,
                method: this.authState.authMethod
            }));

            this.addMessage('🎉 Welcome back! You\'re now logged in to your store account. You can now access your personal cart, view order history, and checkout. How can I help you today?', 'bot');
        },

        fetchCustomerAccountConfig: async function () {
            try {
                const response = await fetch(`${this.apiBaseUrl}/customer-account/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shop: this.shopDomain })
                });
                const config = await response.json();

                if (config.success) {
                    this.customerAccountClientId = config.clientId;
                    this.customerAccountApiEndpoint = config.apiEndpoint;
                    console.log('Customer Account API config loaded:', config);
                }
            } catch (error) {
                console.error('Failed to fetch Customer Account API config:', error);
            }
        },

        connectStoreAccount: function () {
            if (!this.customerAccountClientId) {
                this.addMessage('Customer Account API not configured. Please try again later.', 'bot');
                return;
            }

            // Generate PKCE parameters
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = this.generateCodeChallenge(codeVerifier);

            // Store code verifier for later use
            sessionStorage.setItem(`pkce_verifier_${this.shopDomain}`, codeVerifier);

            // Build OAuth URL
            const params = new URLSearchParams({
                client_id: this.customerAccountClientId,
                redirect_uri: `${window.location.origin}/api/customer-account/callback`,
                response_type: 'code',
                scope: 'customer-account-mcp-api:full',
                state: this.generateState(),
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });

            const authUrl = `${this.customerAccountApiEndpoint}/oauth/authorize?${params}`;

            this.addMessage('Redirecting you to your store account login...', 'bot');
            window.location.href = authUrl;
        },

        generateCodeVerifier: function () {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return this.base64URLEncode(array);
        },

        generateCodeChallenge: function (codeVerifier) {
            const encoder = new TextEncoder();
            const data = encoder.encode(codeVerifier);
            return crypto.subtle.digest('SHA-256', data).then(hash => {
                return this.base64URLEncode(hash);
            });
        },

        base64URLEncode: function (buffer) {
            const base64 = btoa(String.fromCharCode(...buffer));
            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        },

        generateState: function () {
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        },

        handleCustomerAccountCallback: async function (code, state) {
            try {
                const codeVerifier = sessionStorage.getItem(`pkce_verifier_${this.shopDomain}`);
                if (!codeVerifier) {
                    throw new Error('Code verifier not found');
                }

                const response = await fetch(`${this.apiBaseUrl}/customer-account/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        codeVerifier,
                        shop: this.shopDomain
                    })
                });

                const result = await response.json();

                if (result.success) {
                    this.customerAccessToken = result.accessToken;
                    this.handleAuthSuccess({
                        name: result.customer?.name || result.customer?.email,
                        email: result.customer?.email,
                        id: result.customer?.id,
                        accessToken: result.accessToken
                    }, 'customer-account');

                    // Clear PKCE verifier
                    sessionStorage.removeItem(`pkce_verifier_${this.shopDomain}`);
                } else {
                    throw new Error(result.error || 'Authentication failed');
                }
            } catch (error) {
                console.error('Customer Account callback error:', error);
                this.addMessage(`Authentication failed: ${error.message}`, 'bot');
                if (this.onAuthError) this.onAuthError(error);
            }
        },

        initializeAuth: function () {
            // Check if custom auth data is provided
            if (this.authMode === 'custom' && this.customAuthData) {
                this.handleCustomAuth(this.customAuthData);
                return;
            }

            // Check for existing session
            const savedAuth = localStorage.getItem(`aladdyn_auth_${this.shopDomain}`);
            if (savedAuth) {
                try {
                    const authData = JSON.parse(savedAuth);
                    this.authState = {
                        isAuthenticated: true,
                        user: authData.user,
                        authMethod: authData.method,
                        awaitingAuth: false,
                        isGuest: authData.method === 'guest'
                    };
                    this.addMessage(`Welcome back, ${authData.user.name || authData.user.email}! How can I help you today?`, 'bot');
                    return;
                } catch (error) {
                    console.error('Failed to parse saved auth:', error);
                    localStorage.removeItem(`aladdyn_auth_${this.shopDomain}`);
                }
            }

            // Show welcome message with login option
            this.showWelcomeMessage();
        },

        showWelcomeMessage: function () {
            const message = `Welcome to ${this.shopDomain.replace('.myshopify.com', '')}! 👋\n\n` +
                `I'm your shopping assistant. To access your personal cart, order history, and checkout, please sign in to your store account.\n\n` +
                `Click the "Login" button below to continue:`;

            this.addMessage(message, 'bot');

            // Add login button
            this.addLoginButton();
        },

        addLoginButton: function () {
            const messagesContainer = document.getElementById('chat-messages');
            if (!messagesContainer) return;

            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'margin: 10px 0; text-align: center;';

            const loginButton = document.createElement('button');
            loginButton.textContent = '🔐 Login to Store Account';
            loginButton.style.cssText = `
                background: #7c3aed;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
                transition: all 0.2s ease;
            `;

            loginButton.onmouseover = () => {
                loginButton.style.background = '#6d28d9';
                loginButton.style.transform = 'translateY(-1px)';
            };

            loginButton.onmouseout = () => {
                loginButton.style.background = '#7c3aed';
                loginButton.style.transform = 'translateY(0)';
            };

            loginButton.onclick = () => {
                this.loginToStore();
            };

            buttonContainer.appendChild(loginButton);
            messagesContainer.appendChild(buttonContainer);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        },

        loginToStore: function () {
            // Redirect to our callback endpoint which will handle the store login flow
            const callbackUrl = `${this.apiBaseUrl}/store-login/callback?shop=${this.shopDomain}&return_url=${encodeURIComponent(window.location.href)}`;
            this.addMessage('Redirecting you to your store login page...', 'bot');

            // Store current page URL for return
            sessionStorage.setItem(`return_url_${this.shopDomain}`, window.location.href);

            // Redirect to our callback endpoint
            window.location.href = callbackUrl;
        },

        startAuthFlow: function () {
            this.authState.awaitingAuth = true;

            if (this.authMode === 'email') {
                this.addMessage('Hello! Please enter your registered email to continue.', 'bot');
            } else if (this.authMode === 'social') {
                this.showSocialLoginOptions();
            } else if (this.authMode === 'hybrid') {
                this.showAuthOptions();
            }
        },

        showAuthOptions: function () {
            const message = `Welcome! Choose how you'd like to continue:\n\n` +
                `1. **Continue as Guest** - Browse products without signing in\n` +
                `2. **Sign in with Email** - Full access to your account\n` +
                `3. **Social Login** - Quick sign in with Google/Facebook\n` +
                `4. **Connect Store Account** - Access your personal cart & orders\n\n` +
                `Type your choice (1, 2, 3, or 4) or "guest", "email", "social", "store"`;

            this.addMessage(message, 'bot');
        },

        showSocialLoginOptions: function () {
            let message = `Sign in with your social account:\n\n`;
            this.socialProviders.forEach((provider, index) => {
                message += `${index + 1}. **${provider.charAt(0).toUpperCase() + provider.slice(1)}**\n`;
            });
            message += `\nType the provider name or number to continue`;

            this.addMessage(message, 'bot');
        },

        createChatbot: function () {
            console.log('Creating chatbot...');
            const chatWidget = document.createElement('div');
            chatWidget.id = 'aladdyn-chatbot';
            chatWidget.innerHTML = `
                <div style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;">
                    <div id="chat-toggle" style="width: 60px; height: 60px; background: #7c3aed; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <span style="color: white; font-size: 24px;">💬</span>
                    </div>
                    <div id="chat-window" style="display: none; width: 350px; height: 500px; background: white; border-radius: 10px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); position: absolute; bottom: 70px; right: 0;">
                        <div style="padding: 20px; border-bottom: 1px solid #eee; background: #7c3aed; color: white; border-radius: 10px 10px 0 0;">
                            <h3 style="margin: 0; font-size: 16px;">Aladdyn Assistant</h3>
                            <span id="auth-status" style="font-size: 12px; opacity: 0.8;"></span>
                        </div>
                        <div id="chat-messages" style="height: 350px; overflow-y: auto; padding: 15px;"></div>
                        <div style="padding: 15px; border-top: 1px solid #eee;">
                            <input id="chat-input" type="text" placeholder="Type your message..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; outline: none;">
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(chatWidget);
            console.log('Chatbot HTML added to DOM');
            this.bindEvents();
        },

        bindEvents: function () {
            const self = this; // Store reference to this
            const toggle = document.getElementById('chat-toggle');
            const window = document.getElementById('chat-window');
            const input = document.getElementById('chat-input');

            console.log('Binding events...', { toggle, window, input });

            if (toggle) {
                toggle.onclick = function () {
                    console.log('Toggle clicked!');
                    window.style.display = window.style.display === 'none' ? 'block' : 'none';
                    if (window.style.display === 'block') {
                        input.focus();
                    }
                };
                console.log('Toggle click handler bound');
            } else {
                console.error('Toggle element not found!');
            }

            if (input) {
                input.onkeypress = function (e) {
                    if (e.key === 'Enter' && input.value.trim()) {
                        self.sendMessage(input.value.trim());
                        input.value = '';
                    }
                };
                console.log('Input keypress handler bound');
            } else {
                console.error('Input element not found!');
            }
        },

        sendMessage: function (message) {
            this.addMessage(message, 'user');

            if (this.authState.awaitingAuth) {
                this.handleAuthInput(message);
            } else {
                this.handleChatMessage(message);
            }
        },

        handleAuthInput: function (input) {
            const lowerInput = input.toLowerCase().trim();

            if (this.authMode === 'email') {
                this.verifyEmail(input);
            } else if (this.authMode === 'social') {
                this.handleSocialAuth(input);
            } else if (this.authMode === 'hybrid') {
                this.handleHybridAuth(input);
            }
        },

        handleHybridAuth: function (input) {
            const lowerInput = input.toLowerCase().trim();

            if (lowerInput.includes('guest') || lowerInput === '1') {
                this.startGuestMode();
            } else if (lowerInput.includes('email') || lowerInput === '2') {
                this.authState.awaitingAuth = true;
                this.addMessage('Please enter your registered email:', 'bot');
            } else if (lowerInput.includes('social') || lowerInput === '3') {
                this.showSocialLoginOptions();
            } else if (lowerInput.includes('store') || lowerInput === '4') {
                this.connectStoreAccount();
            } else {
                this.addMessage('Please choose an option: "guest", "email", "social", or "store"', 'bot');
            }
        },

        handleSocialAuth: function (provider) {
            const lowerProvider = provider.toLowerCase().trim();

            if (this.socialProviders.includes(lowerProvider)) {
                this.addMessage(`Redirecting to ${lowerProvider} login...`, 'bot');
                // Implement social login logic here
                // For now, simulate success
                setTimeout(() => {
                    this.handleAuthSuccess({
                        name: 'Social User',
                        email: 'user@example.com',
                        provider: lowerProvider
                    }, 'social');
                }, 1000);
            } else {
                this.addMessage(`Please choose from: ${this.socialProviders.join(', ')}`, 'bot');
            }
        },

        verifyEmail: async function (email) {
            this.addMessage('Verifying your email...', 'bot');

            try {
                console.log('Attempting to verify email:', email, 'for shop:', this.shopDomain);
                const response = await fetch(`${this.apiBaseUrl}/verify-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        shop: this.shopDomain
                    })
                });

                console.log('Response status:', response.status);
                const result = await response.json();
                console.log('Response data:', result);

                if (result.verified) {
                    this.handleAuthSuccess({
                        name: result.customer?.name || email,
                        email: email,
                        id: result.customer?.id
                    }, 'email');
                } else {
                    this.addMessage('Email not found. Would you like to continue as a guest or try a different email?', 'bot');
                    if (this.enableGuestMode) {
                        this.addMessage('Type "guest" to continue without signing in.', 'bot');
                    }
                }
            } catch (error) {
                console.error('Email verification error:', error);
                this.addMessage(`Verification failed: ${error.message}. Please try again or type "guest" to continue.`, 'bot');
                if (this.onAuthError) this.onAuthError(error);
            }
        },

        handleCustomAuth: function (authData) {
            this.handleAuthSuccess(authData, 'custom');
        },

        handleAuthSuccess: function (userData, method) {
            const authData = {
                user: userData,
                method: method,
                timestamp: Date.now()
            };

            this.authState = {
                isAuthenticated: true,
                user: userData,
                authMethod: method,
                awaitingAuth: false,
                isGuest: method === 'guest'
            };

            // Save to localStorage for persistence
            localStorage.setItem(`aladdyn_auth_${this.shopDomain}`, JSON.stringify(authData));

            // Call success callback
            if (this.onAuthSuccess) this.onAuthSuccess(authData);

            // Update UI
            this.updateAuthStatus();

            // Welcome message
            const welcomeMsg = method === 'guest'
                ? 'Welcome! You\'re browsing as a guest. How can I help you today?'
                : `Welcome back, ${userData.name || userData.email}! How can I assist you today?`;

            this.addMessage(welcomeMsg, 'bot');
        },

        updateAuthStatus: function () {
            const authStatus = document.getElementById('auth-status');
            if (authStatus) {
                if (this.authState.isGuest) {
                    authStatus.textContent = 'Guest Mode';
                } else if (this.authState.isAuthenticated) {
                    authStatus.textContent = `Signed in as ${this.authState.user.name || this.authState.user.email}`;
                } else {
                    authStatus.textContent = '';
                }
            }
        },

        handleChatMessage: async function (message) {
            try {
                // Parse the user message using OpenAI GPT-4o-mini
                const parseResponse = await fetch(`${this.apiBaseUrl}/chat/parse`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        shop: this.shopDomain,
                        customerEmail: this.authState.user?.email,
                        authMethod: this.authState.authMethod,
                        isGuest: this.authState.isGuest
                    })
                });

                const parsedData = await parseResponse.json();
                const { action, parameters, response } = parsedData;

                // Handle different actions
                switch (action) {
                    case 'PRODUCT_QUERY':
                        await this.handleProductQuery(parameters);
                        break;
                    case 'CART_ADD':
                        await this.handleCartAdd(parameters);
                        break;
                    case 'CART_UPDATE':
                        await this.handleCartUpdate(parameters);
                        break;
                    case 'CART_VIEW':
                        await this.handleCartView(parameters);
                        break;
                    case 'RETURN_POLICY':
                        await this.handleReturnPolicy();
                        break;
                    case 'AUTH_REQUEST':
                        this.handleAuthRequest();
                        break;
                    case 'CUSTOMER_ORDERS':
                        await this.handleCustomerOrders();
                        break;
                    case 'PERSONAL_CART':
                        await this.handlePersonalCart();
                        break;
                    case 'CHECKOUT':
                        await this.handleCheckout();
                        break;
                    default:
                        this.addMessage(response || 'I\'m here to help! You can ask me about products, add items to cart, view your orders, or ask about our return policy.', 'bot');
                }
            } catch (error) {
                console.error('Chat message handling error:', error);
                this.addMessage('I\'m sorry, I encountered an error. Please try again.', 'bot');
            }
        },

        handleAuthRequest: function () {
            if (this.authState.isGuest) {
                this.addMessage('To access full features, please sign in. Type "sign in" to continue.', 'bot');
            } else {
                this.addMessage('You\'re already signed in! How can I help you?', 'bot');
            }
        },

        handleProductQuery: async function (parameters) {
            try {
                const { productQuery, productHandle } = parameters;

                if (productHandle) {
                    // Get specific product
                    const response = await fetch(`${this.apiBaseUrl}/storefront/product`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shop: this.shopDomain,
                            handle: productHandle
                        })
                    });
                    const data = await response.json();

                    if (data.data?.product) {
                        const product = data.data.product;
                        const message = `**${product.title}**\n\n${product.description}\n\nPrice: $${product.priceRange.minVariantPrice.amount} - $${product.priceRange.maxVariantPrice.amount}\n\nAvailable: ${product.availableForSale ? 'Yes' : 'No'}\n\n${product.variants.edges.length > 0 ? `Variants: ${product.variants.edges.length} options available` : ''}`;
                        this.addMessage(message, 'bot');
                    } else {
                        this.addMessage('Product not found. Please try a different search term.', 'bot');
                    }
                } else {
                    // Search products or list all products
                    const searchQuery = productQuery === 'all'
                        ? null
                        : productQuery && !productQuery.toLowerCase().includes('store') && !productQuery.toLowerCase().includes('products')
                            ? productQuery
                            : null;

                    const response = await fetch(`${this.apiBaseUrl}/storefront/products`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shop: this.shopDomain,
                            query: searchQuery,
                            first: 10
                        })
                    });
                    const data = await response.json();

                    if (data.data?.products?.edges?.length > 0) {
                        const products = data.data.products.edges.map(edge => edge.node);
                        let message = `Here are the products in our store:\n\n`;
                        products.forEach(product => {
                            message += `• **${product.title}** - $${product.priceRange.minVariantPrice.amount}\n`;
                            if (product.description) {
                                message += `  ${product.description.substring(0, 100)}...\n`;
                            }
                            message += `  Available: ${product.availableForSale ? 'Yes' : 'No'}\n\n`;
                        });
                        this.addMessage(message, 'bot');
                    } else {
                        this.addMessage('No products found. Please try a different search term.', 'bot');
                    }
                }
            } catch (error) {
                console.error('Product query error:', error);
                this.addMessage('Sorry, I couldn\'t search for products right now. Please try again.', 'bot');
            }
        },

        handleCartAdd: async function (parameters) {
            try {
                const { variantId, quantity = 1, productQuery, variantTitle } = parameters;

                // If no variantId is provided, we need to get the product first
                if (!variantId && productQuery) {
                    // Get product details to show variants
                    const response = await fetch(`${this.apiBaseUrl}/storefront/products`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shop: this.shopDomain,
                            query: productQuery,
                            first: 1
                        })
                    });
                    const data = await response.json();

                    if (data.data?.products?.edges?.length > 0) {
                        const product = data.data.products.edges[0].node;

                        // If variantTitle is provided, try to find matching variant
                        if (variantTitle) {
                            const matchingVariant = product.variants.edges.find(edge =>
                                edge.node.title.toLowerCase().includes(variantTitle.toLowerCase()) ||
                                variantTitle.toLowerCase().includes(edge.node.title.toLowerCase())
                            );

                            if (matchingVariant) {
                                await this.addToCart(matchingVariant.node.id, quantity);
                                return;
                            }
                        }

                        if (product.variants.edges.length > 1) {
                            // Product has multiple variants, ask user to choose
                            let message = `**${product.title}** has multiple options:\n\n`;
                            product.variants.edges.forEach((variantEdge, index) => {
                                const variant = variantEdge.node;
                                message += `${index + 1}. **${variant.title}** - $${variant.price.amount}\n`;
                            });
                            message += `\nPlease specify which option you'd like (e.g., "add $10 gift card" or "add option 1")`;
                            this.addMessage(message, 'bot');
                            return;
                        } else if (product.variants.edges.length === 1) {
                            // Product has only one variant, use it
                            const variant = product.variants.edges[0].node;
                            await this.addToCart(variant.id, quantity);
                            return;
                        }
                    } else {
                        this.addMessage('Product not found. Please try a different product name.', 'bot');
                        return;
                    }
                }

                if (!variantId) {
                    this.addMessage('Please specify which product variant you\'d like to add to cart.', 'bot');
                    return;
                }

                await this.addToCart(variantId, quantity);
            } catch (error) {
                console.error('Cart add error:', error);
                this.addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot');
            }
        },

        addToCart: async function (variantId, quantity) {
            try {
                const lines = [{
                    merchandiseId: variantId,
                    quantity: parseInt(quantity)
                }];

                const requestBody = {
                    shop: this.shopDomain,
                    lines
                };

                // Include customer access token if available
                if (this.customerAccessToken) {
                    requestBody.customerAccessToken = this.customerAccessToken;
                }

                let response;
                if (this.currentCartId) {
                    // Add to existing cart
                    requestBody.cartId = this.currentCartId;
                    response = await fetch(`${this.apiBaseUrl}/storefront/cart/add-lines`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                } else {
                    // Create new cart
                    response = await fetch(`${this.apiBaseUrl}/storefront/cart/create`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody)
                    });
                }

                const data = await response.json();

                if (data.data?.cartCreate?.cart || data.data?.cartLinesAdd?.cart) {
                    const cart = data.data.cartCreate?.cart || data.data.cartLinesAdd.cart;
                    this.currentCartId = cart.id;
                    this.addMessage(`✅ Added ${quantity} item(s) to your cart! Total items: ${cart.totalQuantity}`, 'bot');
                } else {
                    this.addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot');
                }
            } catch (error) {
                console.error('Add to cart error:', error);
                this.addMessage('Sorry, I couldn\'t add that item to your cart. Please try again.', 'bot');
            }
        },

        handleCartUpdate: async function (parameters) {
            try {
                const { variantId, quantity } = parameters;

                if (!this.currentCartId) {
                    this.addMessage('You don\'t have any items in your cart yet.', 'bot');
                    return;
                }

                if (!variantId || !quantity) {
                    this.addMessage('Please specify which item and quantity to update.', 'bot');
                    return;
                }

                const lines = [{
                    id: variantId,
                    quantity: parseInt(quantity)
                }];

                const response = await fetch(`${this.apiBaseUrl}/storefront/cart/update-lines`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: this.shopDomain,
                        cartId: this.currentCartId,
                        lines
                    })
                });

                const data = await response.json();

                if (data.data?.cartLinesUpdate?.cart) {
                    const cart = data.data.cartLinesUpdate.cart;
                    this.addMessage(`✅ Updated cart! Total items: ${cart.totalQuantity}`, 'bot');
                } else {
                    this.addMessage('Sorry, I couldn\'t update your cart. Please try again.', 'bot');
                }
            } catch (error) {
                console.error('Cart update error:', error);
                this.addMessage('Sorry, I couldn\'t update your cart. Please try again.', 'bot');
            }
        },

        handleCartView: async function (parameters) {
            try {
                if (!this.currentCartId) {
                    this.addMessage('Your cart is empty. You can add items by asking me about products!', 'bot');
                    return;
                }

                const response = await fetch(`${this.apiBaseUrl}/storefront/cart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: this.shopDomain,
                        cartId: this.currentCartId
                    })
                });

                const data = await response.json();

                if (data.data?.cart) {
                    const cart = data.data.cart;
                    let message = `**Your Cart** (${cart.totalQuantity} items)\n\n`;

                    if (cart.lines.edges.length > 0) {
                        cart.lines.edges.forEach(edge => {
                            const line = edge.node;
                            message += `• ${line.merchandise.product.title} (${line.quantity}x) - $${line.merchandise.price.amount}\n`;
                        });
                        message += `\n**Total: $${cart.cost.totalAmount.amount}**`;
                    } else {
                        message = 'Your cart is empty.';
                    }

                    this.addMessage(message, 'bot');
                } else {
                    this.addMessage('Sorry, I couldn\'t retrieve your cart. Please try again.', 'bot');
                }
            } catch (error) {
                console.error('Cart view error:', error);
                this.addMessage('Sorry, I couldn\'t retrieve your cart. Please try again.', 'bot');
            }
        },

        handleReturnPolicy: async function () {
            this.addMessage(`**Return Policy**\n\nWe offer a 30-day return policy for most items. Items must be in original condition with tags attached.\n\n• Electronics: 14-day return window\n• Clothing: 30-day return window\n• Sale items: Final sale, no returns\n\nFor returns, please contact our customer service team.`, 'bot');
        },

        handleCustomerOrders: async function () {
            if (!this.customerAccessToken) {
                this.addMessage('Please connect your store account to view your order history. Type "store" to connect.', 'bot');
                return;
            }

            try {
                const response = await fetch(`${this.apiBaseUrl}/customer-account/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: this.shopDomain,
                        customerAccessToken: this.customerAccessToken
                    })
                });

                const data = await response.json();

                if (data.success && data.orders?.length > 0) {
                    let message = `**Your Order History**\n\n`;
                    data.orders.slice(0, 5).forEach(order => {
                        message += `• **Order #${order.orderNumber}** - $${order.totalPrice.amount}\n`;
                        message += `  Status: ${order.fulfillmentStatus}\n`;
                        message += `  Date: ${new Date(order.processedAt).toLocaleDateString()}\n\n`;
                    });

                    if (data.orders.length > 5) {
                        message += `... and ${data.orders.length - 5} more orders`;
                    }

                    this.addMessage(message, 'bot');
                } else {
                    this.addMessage('You don\'t have any orders yet. Start shopping to see your order history here!', 'bot');
                }
            } catch (error) {
                console.error('Customer orders error:', error);
                this.addMessage('Sorry, I couldn\'t retrieve your order history. Please try again.', 'bot');
            }
        },

        handlePersonalCart: async function () {
            if (!this.customerAccessToken) {
                this.addMessage('Please connect your store account to access your personal cart. Type "store" to connect.', 'bot');
                return;
            }

            try {
                const response = await fetch(`${this.apiBaseUrl}/customer-account/cart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: this.shopDomain,
                        customerAccessToken: this.customerAccessToken
                    })
                });

                const data = await response.json();

                if (data.success && data.cart) {
                    const cart = data.cart;
                    let message = `**Your Personal Cart** (${cart.totalQuantity} items)\n\n`;

                    if (cart.lines?.edges?.length > 0) {
                        cart.lines.edges.forEach(edge => {
                            const line = edge.node;
                            message += `• ${line.merchandise.product.title} (${line.quantity}x) - $${line.merchandise.price.amount}\n`;
                        });
                        message += `\n**Total: $${cart.cost.totalAmount.amount}**`;
                    } else {
                        message = 'Your personal cart is empty.';
                    }

                    this.addMessage(message, 'bot');
                } else {
                    this.addMessage('Your personal cart is empty. Start adding items to see them here!', 'bot');
                }
            } catch (error) {
                console.error('Personal cart error:', error);
                this.addMessage('Sorry, I couldn\'t retrieve your personal cart. Please try again.', 'bot');
            }
        },

        handleCheckout: async function () {
            if (!this.customerAccessToken) {
                this.addMessage('Please connect your store account to proceed to checkout. Type "store" to connect.', 'bot');
                return;
            }

            try {
                const response = await fetch(`${this.apiBaseUrl}/customer-account/checkout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shop: this.shopDomain,
                        customerAccessToken: this.customerAccessToken
                    })
                });

                const data = await response.json();

                if (data.success && data.checkoutUrl) {
                    this.addMessage('Redirecting you to checkout...', 'bot');
                    window.open(data.checkoutUrl, '_blank');
                } else {
                    this.addMessage('Sorry, I couldn\'t create a checkout session. Please try again.', 'bot');
                }
            } catch (error) {
                console.error('Checkout error:', error);
                this.addMessage('Sorry, I couldn\'t proceed to checkout. Please try again.', 'bot');
            }
        },

        addMessage: function (text, sender) {
            const messages = document.getElementById('chat-messages');
            if (!messages) return;

            const msg = document.createElement('div');
            msg.style.cssText = `margin-bottom: 10px; padding: 8px 12px; border-radius: 15px; max-width: 80%; ${sender === 'user'
                ? 'background: #7c3aed; color: white; margin-left: auto; text-align: right;'
                : 'background: #f1f5f9; color: #334155;'
                }`;
            msg.innerHTML = text.replace(/\n/g, '<br>');
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
        }
    };

    // Don't auto-initialize - let the user call init() with proper configuration
})();
