(function() {
  const shop = window.ALADDYN_SHOP || 'demo.myshopify.com';
  const scriptId = window.ALLADYN_SCRIPT_ID || 'demo_script';
  
  console.log('Aladdyn Genie loaded for ' + shop);
  
  window.AladdynGenie = {
    shopDomain: shop,
    scriptId: scriptId,
    
    init: function() {
      this.createChatbot();
      console.log('Genie chatbot initialized');
    },
    
    createChatbot: function() {
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
    
    bindEvents: function() {
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
    
    addWelcomeMessage: function() {
      this.addMessage('Hello! How can I help you today?', 'bot');
    },
    
    sendMessage: function(message) {
      this.addMessage(message, 'user');
      this.handleChatMessage(message);
    },
    
    handleChatMessage: async function(message) {
      this.addMessage('Let me help you with that...', 'bot');
      
      try {
        const response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: message,
            shop: this.shopDomain
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          this.addMessage(result.response, 'bot');
        } else {
          this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        }
      } catch (error) {
        this.addMessage('Sorry, I\'m having trouble connecting. Please try again.', 'bot');
      }
    },
    
    addMessage: function(text, sender) {
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