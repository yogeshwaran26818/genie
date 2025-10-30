(function () {
    console.log('Aladdyn Genie loaded for testing-aladyyn.myshopify.com');

    window.AladdynGenie = {
        shopDomain: 'testing-aladyyn.myshopify.com',
        scriptId: 'genie_1761564525933_krnyyswh1',
        awaitingEmail: false,
        customerEmail: null,
        currentProducts: null,
        currentCartId: null,

        init: function () {
            this.createChatbot();
            console.log('Genie chatbot initialized');
        },

        createChatbot: function () {
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
            </div>
            <div id="chat-messages" style="height: 350px; overflow-y: auto; padding: 15px;"></div>
            <div style="padding: 15px; border-top: 1px solid #eee;">
              <input id="chat-input" type="text" placeholder="Type your message..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; outline: none;">
            </div>
          </div>
        </div>
      `;

            document.body.appendChild(chatWidget);
            this.bindEvents();
            this.addWelcomeMessage();
        },

        bindEvents: function () {
            const toggle = document.getElementById('chat-toggle');
            const window = document.getElementById('chat-window');
            const input = document.getElementById('chat-input');

            toggle.onclick = () => {
                window.style.display = window.style.display === 'none' ? 'block' : 'none';
            };

            input.onkeypress = (e) => {
                if (e.key === 'Enter' && input.value.trim()) {
                    this.sendMessage(input.value.trim());
                    input.value = '';
                }
            };
        },

        addWelcomeMessage: function () {
            this.addMessage('Hello! Please enter your registered email to continue.', 'bot');
            this.awaitingEmail = true;
        },

        sendMessage: function (message) {
            this.addMessage(message, 'user');

            if (this.awaitingEmail) {
                this.verifyEmail(message);
            } else {
                this.handleChatMessage(message);
            }
        },

        verifyEmail: async function (email) {
            this.addMessage('Verifying your email...', 'bot');

            try {
                console.log('Attempting to verify email:', email, 'for shop:', this.shopDomain);
                const response = await fetch('/api/verify-email', {
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
                    this.awaitingEmail = false;
                    this.customerEmail = email;
                    this.addMessage('Email verified! How can I assist you today?', 'bot');
                } else {
                    this.addMessage('Email not found. Please enter your registered email.', 'bot');
                }
            } catch (error) {
                console.error('Email verification error:', error);
                this.addMessage(`Verification failed: ${error.message}. Please try again.`, 'bot');
            }
        },

        handleChatMessage: async function (message) {
            try {
                // Parse the user message using OpenAI GPT-4o-mini
                const parseResponse = await fetch('/api/chat/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        shop: this.shopDomain,
                        customerEmail: this.customerEmail
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
                    default:
                        this.addMessage(response || 'I\'m here to help! You can ask me about products, add items to cart, or ask about our return policy.', 'bot');
                }
            } catch (error) {
                console.error('Chat message handling error:', error);
                this.addMessage('I\'m sorry, I encountered an error. Please try again.', 'bot');
            }
        },

        handleProductQuery: async function (parameters) {
            try {
                const { productQuery, productHandle } = parameters;

                if (productHandle) {
                    // Get specific product
                    const response = await fetch('/api/storefront/product', {
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

                    const response = await fetch('/api/storefront/products', {
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
                    const response = await fetch('/api/storefront/products', {
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

                let response;
                if (this.currentCartId) {
                    // Add to existing cart
                    response = await fetch('/api/storefront/cart/add-lines', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shop: this.shopDomain,
                            cartId: this.currentCartId,
                            lines
                        })
                    });
                } else {
                    // Create new cart
                    response = await fetch('/api/storefront/cart/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shop: this.shopDomain,
                            lines
                        })
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

                const response = await fetch('/api/storefront/cart/update-lines', {
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

                const response = await fetch('/api/storefront/cart', {
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

        addMessage: function (text, sender) {
            const messages = document.getElementById('chat-messages');
            const msg = document.createElement('div');
            msg.style.cssText = `margin-bottom: 10px; padding: 8px 12px; border-radius: 15px; max-width: 80%; ${sender === 'user' ? 'background: #7c3aed; color: white; margin-left: auto; text-align: right;' : 'background: #f1f5f9; color: #334155;'}`;
            msg.textContent = text;
            messages.appendChild(msg);
            messages.scrollTop = messages.scrollHeight;
        }
    };

    window.AladdynGenie.init();
})();
