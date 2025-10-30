export const generateGenieScript = (shopDomain, scriptId) => {
  return `<script>
(function() {
  console.log('Aladdyn Genie loaded for ${shopDomain}');
  
  window.AladdynGenie = {
    shopDomain: '${shopDomain}',
    scriptId: '${scriptId}',
    
    init: function() {
      this.createChatbot();
      console.log('Genie chatbot initialized');
    },
    
    createChatbot: function() {
      const React = window.React;
      const { useState, useRef, useEffect } = React;
      
      const Chatbot = () => {
        const [isOpen, setIsOpen] = useState(false);
        const [messages, setMessages] = useState([
          { id: 1, text: "Hi! I'm your shopping assistant. How can I help you today?", sender: 'assistant' }
        ]);
        const [inputValue, setInputValue] = useState('');
        const [isTyping, setIsTyping] = useState(false);
        const messagesEndRef = useRef(null);

        const scrollToBottom = () => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        };

        useEffect(() => {
          scrollToBottom();
        }, [messages]);

        const handleSend = () => {
          if (!inputValue.trim()) return;

          const userMessage = {
            id: Date.now(),
            text: inputValue,
            sender: 'user'
          };

          setMessages(prev => [...prev, userMessage]);
          setInputValue('');
          setIsTyping(true);

          setTimeout(() => {
            const botMessage = {
              id: Date.now() + 1,
              text: "Thanks for your message! I'm here to help you find products for " + window.AladdynGenie.shopDomain,
              sender: 'assistant'
            };
            setMessages(prev => [...prev, botMessage]);
            setIsTyping(false);
          }, 1500);
        };

        const handleKeyPress = (e) => {
          if (e.key === 'Enter') {
            handleSend();
          }
        };

        return React.createElement('div', { className: 'shop-ai-chat-container' },
          React.createElement('div', {
            className: 'shop-ai-chat-bubble' + (isOpen ? ' active' : ''),
            onClick: () => setIsOpen(!isOpen)
          },
            React.createElement('svg', { width: '30', height: '30', viewBox: '0 0 24 24', fill: 'white' },
              React.createElement('path', { d: 'M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3.04 1.05 4.35L2 22l5.65-1.05C9.96 21.64 11.46 22 13 22h7c1.1 0 2-.9 2-2V12c0-5.52-4.48-10-10-10z' })
            )
          ),
          React.createElement('div', { className: 'shop-ai-chat-window' + (isOpen ? ' active' : '') },
            React.createElement('div', { className: 'shop-ai-chat-header' },
              React.createElement('span', null, 'Shop Assistant'),
              React.createElement('button', {
                className: 'shop-ai-chat-close',
                onClick: () => setIsOpen(false)
              }, '×')
            ),
            React.createElement('div', { className: 'shop-ai-chat-messages' },
              ...messages.map(message =>
                React.createElement('div', {
                  key: message.id,
                  className: 'shop-ai-message ' + message.sender
                }, message.text)
              ),
              isTyping && React.createElement('div', { className: 'shop-ai-typing-indicator' },
                React.createElement('span'),
                React.createElement('span'),
                React.createElement('span')
              ),
              React.createElement('div', { ref: messagesEndRef })
            ),
            React.createElement('div', { className: 'shop-ai-chat-input' },
              React.createElement('input', {
                type: 'text',
                value: inputValue,
                onChange: (e) => setInputValue(e.target.value),
                onKeyPress: handleKeyPress,
                placeholder: 'Type your message...'
              }),
              React.createElement('button', {
                className: 'shop-ai-chat-send',
                onClick: handleSend
              },
                React.createElement('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'white' },
                  React.createElement('path', { d: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' })
                )
              )
            )
          )
        );
      };

      // Add styles
      const style = document.createElement('style');
      style.textContent = \`
        .shop-ai-chat-container { position: fixed; bottom: 20px; right: 20px; z-index: 9999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .shop-ai-chat-bubble { width: 60px; height: 60px; background-color: #5046e4; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: transform 0.3s ease; }
        .shop-ai-chat-bubble:hover { transform: scale(1.05); }
        .shop-ai-chat-window { position: absolute; bottom: 80px; right: 0; width: 450px; height: 650px; background-color: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; overflow: hidden; opacity: 0; pointer-events: none; transform: translateY(20px); transition: opacity 0.3s ease, transform 0.3s ease; }
        .shop-ai-chat-window.active { opacity: 1; pointer-events: all; transform: translateY(0); }
        .shop-ai-chat-header { padding: 16px; background-color: #5046e4; color: white; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
        .shop-ai-chat-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0; line-height: 1; }
        .shop-ai-chat-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .shop-ai-message { max-width: 80%; padding: 12px 16px; border-radius: 18px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
        .shop-ai-message.assistant { align-self: flex-start; background-color: #f1f1f1; border-bottom-left-radius: 4px; }
        .shop-ai-message.user { align-self: flex-end; background-color: #5046e4; color: white; border-bottom-right-radius: 4px; }
        .shop-ai-typing-indicator { display: flex; align-items: center; gap: 4px; padding: 8px 16px; background-color: #f1f1f1; border-radius: 18px; border-bottom-left-radius: 4px; align-self: flex-start; font-size: 14px; }
        .shop-ai-typing-indicator span { width: 8px; height: 8px; border-radius: 50%; background-color: #606060; display: inline-block; animation: typing 1.4s infinite both; }
        .shop-ai-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .shop-ai-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        .shop-ai-chat-input { border-top: 1px solid #e9e9e9; padding: 16px; display: flex; gap: 8px; align-items: center; }
        .shop-ai-chat-input input { flex: 1; padding: 12px 16px; border: 1px solid #e9e9e9; border-radius: 24px; font-size: 14px; outline: none; }
        .shop-ai-chat-input input:focus { border-color: #5046e4; }
        .shop-ai-chat-send { background-color: #5046e4; color: white; border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        @keyframes typing { 0% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(1); } }
        @media (max-width: 480px) { .shop-ai-chat-window { position: fixed; width: 100vw; height: 100vh; top: 0; left: 0; right: 0; bottom: 0; border-radius: 0; transform: translateY(100%); } .shop-ai-chat-window.active { transform: translateY(0); } .shop-ai-chat-bubble { width: 50px; height: 50px; } .shop-ai-chat-container { bottom: 10px; right: 10px; } }
      \`;
      document.head.appendChild(style);

      // Render chatbot
      const container = document.createElement('div');
      document.body.appendChild(container);
      ReactDOM.render(React.createElement(Chatbot), container);
    }
  };
  
  // Load React if not available
  if (!window.React) {
    const script1 = document.createElement('script');
    script1.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
      script2.onload = () => window.AladdynGenie.init();
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  } else {
    window.AladdynGenie.init();
  }
})();
</script>`;
};