# 🌐 Aladdyn Chatbot for External Websites

A flexible Shopify Storefront MCP chatbot that can be embedded on any website with multiple authentication options.

## 🚀 Quick Start

### 1. Basic Integration (Guest Mode)
```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <!-- Your website content -->
    
    <!-- Load Aladdyn Chatbot -->
    <script src="https://your-domain.com/aladdyn-genie-external.js"></script>
    <script>
        AladdynGenie.init({
            shopDomain: 'your-store.myshopify.com',
            authMode: 'guest',
            apiBaseUrl: 'https://your-api.com/api'
        });
    </script>
</body>
</html>
```

### 2. React Component Integration
```jsx
import AladdynChatbot from './components/AladdynChatbot'

function MyWebsite() {
  return (
    <div>
      {/* Your website content */}
      
      <AladdynChatbot 
        shopDomain="your-store.myshopify.com"
        authMode="hybrid"
        enableGuestMode={true}
        apiBaseUrl="/api"
      />
    </div>
  )
}
```

## 🔐 Authentication Modes

### 1. Guest Mode (`authMode: 'guest'`)
- **Best for**: Quick interactions, anonymous browsing
- **Features**: Browse products, add to cart, view cart
- **Limitations**: No order history, limited personalization
- **User Experience**: No login required

```javascript
AladdynGenie.init({
    authMode: 'guest',
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
```

### 2. Email Authentication (`authMode: 'email'`)
- **Best for**: Existing Shopify customers
- **Features**: Full account access, order history, personalized recommendations
- **Requirements**: Customer must exist in Shopify database
- **User Experience**: Enter email → verification → full access

```javascript
AladdynGenie.init({
    authMode: 'email',
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
```

### 3. Hybrid Mode (`authMode: 'hybrid'`) - **RECOMMENDED**
- **Best for**: Maximum flexibility and user choice
- **Features**: Users can choose guest or full authentication
- **User Experience**: Choice screen → guest or email/social login
- **Benefits**: No friction for casual users, full features for engaged users

```javascript
AladdynGenie.init({
    authMode: 'hybrid',
    enableGuestMode: true,
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
```

### 4. Social Login (`authMode: 'social'`)
- **Best for**: Modern websites with social integration
- **Features**: Quick authentication with Google, Facebook, Apple
- **User Experience**: Click provider → OAuth flow → instant access
- **Requirements**: Social login setup

```javascript
AladdynGenie.init({
    authMode: 'social',
    socialProviders: ['google', 'facebook', 'apple'],
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
```

### 5. Store Account Authentication (`authMode: 'hybrid'` with store option) - **⭐ NEW**
- **Best for**: Full Shopify customer experience
- **Features**: Direct access to personal cart, order history, checkout
- **User Experience**: OAuth flow → full store account access
- **Benefits**: Complete integration with Shopify customer data

```javascript
AladdynGenie.init({
    authMode: 'hybrid', // Includes store account option
    enableGuestMode: true,
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
    // Store account OAuth handled automatically
});
```

### 6. Custom Authentication (`authMode: 'custom'`)
- **Best for**: Websites with existing authentication systems
- **Features**: Integrate with your current user management
- **User Experience**: Seamless integration with your auth flow
- **Requirements**: Pass user data to chatbot

```javascript
// Get user data from your authentication system
const userData = {
    name: 'John Doe',
    email: 'john@example.com',
    id: 'user123',
    // Add any additional user data
};

AladdynGenie.init({
    authMode: 'custom',
    customAuthData: userData,
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
```

## ⚙️ Configuration Options

### Complete Configuration Object
```javascript
AladdynGenie.init({
    // Authentication Settings
    authMode: 'hybrid',                    // 'guest', 'email', 'social', 'custom', 'hybrid'
    enableGuestMode: true,                 // Allow guest browsing
    socialProviders: ['google', 'facebook', 'apple'], // Available social logins
    
    // Store Configuration
    shopDomain: 'your-store.myshopify.com', // Your Shopify store domain
    apiBaseUrl: 'https://your-api.com/api',  // Your API endpoint
    
    // Custom Authentication
    customAuthData: null,                  // User data for custom auth
    
    // Callbacks
    onAuthSuccess: function(authData) {
        console.log('User authenticated:', authData);
        // Handle successful authentication
        // authData contains: { user, method, timestamp }
    },
    
    onAuthError: function(error) {
        console.error('Authentication failed:', error);
        // Handle authentication errors
    }
});
```

## 🛠️ API Requirements

### Required Endpoints
Your API must provide these endpoints:

1. **Email Verification**
   ```
   POST /api/verify-email
   Body: { email: string, shop: string }
   Response: { verified: boolean, customer?: object }
   ```

2. **Product Search**
   ```
   POST /api/storefront/products
   Body: { shop: string, query?: string, first: number }
   Response: { data: { products: { edges: [...] } } }
   ```

3. **Cart Operations**
   ```
   POST /api/storefront/cart/create
   POST /api/storefront/cart/add-lines
   POST /api/storefront/cart/update-lines
   POST /api/storefront/cart
   ```

4. **Chat Parsing**
   ```
   POST /api/chat/parse
   Body: { message: string, shop: string, customerEmail?: string }
   Response: { action: string, parameters: object, response: string }
   ```

### CORS Configuration
Make sure your API handles CORS for external websites:

```javascript
// Express.js example
app.use(cors({
    origin: ['https://your-website.com', 'https://another-site.com'],
    credentials: true
}));
```

## 📱 User Interactions

### Available Commands
Users can interact with the chatbot using natural language:

- **Product Browsing**: "What products do you have?", "Show me all products"
- **Product Search**: "Show me snowboards", "Find gift cards"
- **Add to Cart**: "Add $10 gift card to my cart", "Add snowboard"
- **Cart Management**: "Show my cart", "Update cart", "Remove items"
- **Information**: "What's your return policy?", "Help"
- **Authentication**: "Sign in", "Continue as guest", "Connect store account"
- **Store Account Features**: "Show my orders", "Show my personal cart", "Checkout"

### Example Conversations

#### Store Account User Flow
```
User: "Connect store account"
Bot: "Redirecting you to your store account login..."

[After OAuth flow]
Bot: "Welcome back, John! How can I assist you today?"

User: "Show my orders"
Bot: "Your Order History: • Order #1001 - $45.00 Status: Fulfilled Date: 12/15/2023"

User: "Show my personal cart"
Bot: "Your Personal Cart (2 items): • Snowboard (1x) - $299.00 • Gift Card (1x) - $25.00 Total: $324.00"

User: "Checkout"
Bot: "Redirecting you to checkout..."
```

#### Guest User Flow
```
User: "What products do you have?"
Bot: "Here are the products in our store: [product list]"

User: "Add $10 gift card to my cart"
Bot: "✅ Added 1 item(s) to your cart! Total items: 1"

User: "Show my cart"
Bot: "Your Cart (1 items): • Gift Card (1x) - $10.00"
```

#### Authenticated User Flow
```
User: "Sign in"
Bot: "Welcome! Choose how you'd like to continue:
1. Continue as Guest
2. Sign in with Email
3. Social Login"

User: "2"
Bot: "Please enter your registered email:"

User: "john@example.com"
Bot: "Welcome back, John! How can I assist you today?"
```

## 🔧 Advanced Features

### Session Persistence
The chatbot automatically saves authentication state in localStorage:
```javascript
// Automatically saved
localStorage.setItem(`aladdyn_auth_${shopDomain}`, JSON.stringify({
    user: { name: 'John', email: 'john@example.com' },
    method: 'email',
    timestamp: 1640995200000
}));
```

### Custom Styling
You can customize the chatbot appearance by overriding CSS:
```css
#aladdyn-chatbot #chat-toggle {
    background: #your-brand-color !important;
}

#aladdyn-chatbot #chat-window {
    border-radius: 15px !important;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important;
}
```

### Event Handling
Listen to chatbot events:
```javascript
// Authentication events
AladdynGenie.onAuthSuccess = function(authData) {
    // Track user authentication
    analytics.track('chatbot_auth_success', {
        method: authData.method,
        userId: authData.user.id
    });
};

AladdynGenie.onAuthError = function(error) {
    // Handle authentication failures
    console.error('Auth failed:', error);
};
```

## 🚀 Deployment Examples

### 1. WordPress Website
```php
<!-- In your theme's footer.php -->
<script src="https://your-domain.com/aladdyn-genie-external.js"></script>
<script>
AladdynGenie.init({
    authMode: 'hybrid',
    shopDomain: 'your-store.myshopify.com',
    apiBaseUrl: 'https://your-api.com/api'
});
</script>
```

### 2. Shopify Theme
```liquid
<!-- In your theme.liquid -->
<script src="https://your-domain.com/aladdyn-genie-external.js"></script>
<script>
AladdynGenie.init({
    authMode: 'custom',
    customAuthData: {
        name: '{{ customer.first_name }} {{ customer.last_name }}',
        email: '{{ customer.email }}',
        id: '{{ customer.id }}'
    },
    shopDomain: '{{ shop.permanent_domain }}',
    apiBaseUrl: 'https://your-api.com/api'
});
</script>
```

### 3. React Website
```jsx
import { useEffect } from 'react';

function MyWebsite() {
  useEffect(() => {
    // Load external script
    const script = document.createElement('script');
    script.src = 'https://your-domain.com/aladdyn-genie-external.js';
    script.onload = () => {
      window.AladdynGenie.init({
        authMode: 'hybrid',
        shopDomain: 'your-store.myshopify.com',
        apiBaseUrl: 'https://your-api.com/api'
      });
    };
    document.body.appendChild(script);
  }, []);

  return <div>Your website content</div>;
}
```

## 🔒 Security Considerations

### API Security
- Use HTTPS for all API endpoints
- Implement rate limiting
- Validate all input data
- Use proper authentication tokens

### Data Privacy
- Comply with GDPR/CCPA regulations
- Don't store sensitive user data in localStorage
- Implement proper data retention policies
- Provide clear privacy notices

### CORS Configuration
```javascript
// Secure CORS setup
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://your-website.com',
            'https://your-other-site.com'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
```

## 📊 Analytics & Tracking

### User Behavior Tracking
```javascript
AladdynGenie.init({
    // ... other config
    
    onAuthSuccess: function(authData) {
        // Track authentication
        gtag('event', 'chatbot_auth', {
            'method': authData.method,
            'user_type': authData.user.isGuest ? 'guest' : 'authenticated'
        });
    }
});

// Track chatbot interactions
document.addEventListener('click', function(e) {
    if (e.target.closest('#aladdyn-chatbot')) {
        gtag('event', 'chatbot_interaction', {
            'interaction_type': 'click'
        });
    }
});
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure your API allows requests from external domains
   - Check CORS headers in your API responses

2. **Authentication Failures**
   - Verify email exists in Shopify customer database
   - Check API endpoint URLs are correct
   - Ensure proper error handling

3. **Cart Not Persisting**
   - Check localStorage is enabled
   - Verify cart ID is being saved correctly
   - Ensure API endpoints return proper cart data

### Debug Mode
Enable debug logging:
```javascript
AladdynGenie.init({
    // ... other config
    debug: true  // Enable console logging
});
```

## 📞 Support

For technical support or feature requests:
- Email: support@aladdyn.com
- Documentation: https://docs.aladdyn.com
- GitHub Issues: https://github.com/aladdyn/chatbot/issues

---

**Made with ❤️ by Aladdyn Team**
