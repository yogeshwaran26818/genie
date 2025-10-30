import React from 'react';
import ChatBot from '../components/ChatBot';

export default function ChatPage() {
  const shopDomain = window.location.origin.replace('http://', '').replace('https://', '');

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Aladdyn Chat Assistant</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-600 mb-4">
            This is a demo page for the Aladdyn Chat Assistant. The chatbot will appear in the bottom-right corner.
          </p>
          <p className="text-sm text-gray-500">
            Shop Domain: {shopDomain}
          </p>
        </div>
        <ChatBot shopDomain={shopDomain} />
      </div>
    </div>
  );
}