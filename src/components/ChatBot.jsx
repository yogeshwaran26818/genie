import React, { useState, useRef, useEffect } from 'react';
import OpenAIService from '../services/openaiService.js';

export default function ChatBot({ shopDomain }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const openaiService = useRef(new OpenAIService());

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage('Hello! How can I help you today?', 'bot');
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addMessage = (text, sender) => {
    setMessages(prev => [...prev, { text, sender, timestamp: Date.now() }]);
  };



  const handleChatMessage = async (message) => {
    setIsLoading(true);
    addMessage('Processing...', 'bot');

    try {
      // Simple OpenAI call without tools for now
      const response = await openaiService.current.chat([
        { role: 'user', content: message }
      ]);
      
      addMessage(response.content || 'I can help you with store information. What would you like to know?', 'bot');
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback responses based on message content
      if (message.toLowerCase().includes('product')) {
        addMessage('I can help you find products in the store. What type of product are you looking for?', 'bot');
      } else if (message.toLowerCase().includes('order')) {
        addMessage('I can help you with order information. Please provide more details about what you need.', 'bot');
      } else {
        addMessage('I\'m here to help with your store questions. You can ask about products, orders, or general store information.', 'bot');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage(userMessage, 'user');
    handleChatMessage(userMessage);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          background: '#7c3aed',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          color: 'white',
          fontSize: '24px'
        }}
      >
        💬
      </div>

      {isOpen && (
        <div style={{
          width: '350px',
          height: '500px',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
          position: 'absolute',
          bottom: '70px',
          right: '0',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #eee',
            background: '#7c3aed',
            color: 'white',
            borderRadius: '10px 10px 0 0'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Aladdyn Assistant</h3>

          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '15px'
          }}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '10px',
                  padding: '8px 12px',
                  borderRadius: '15px',
                  maxWidth: '80%',
                  backgroundColor: message.sender === 'user' 
                    ? '#7c3aed' 
                    : message.sender === 'system'
                    ? '#fbbf24'
                    : '#f1f5f9',
                  color: message.sender === 'user' 
                    ? 'white' 
                    : message.sender === 'system'
                    ? 'white'
                    : '#334155',
                  marginLeft: message.sender === 'user' ? 'auto' : '0',
                  textAlign: message.sender === 'user' ? 'right' : 'left',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {message.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: '15px',
            borderTop: '1px solid #eee'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                style={{
                  padding: '10px 15px',
                  background: '#7c3aed',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  opacity: isLoading || !input.trim() ? 0.5 : 1
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}