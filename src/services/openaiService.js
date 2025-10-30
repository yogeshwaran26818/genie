import OpenAI from 'openai';

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }

  async chat(messages, tools = []) {
    try {
      console.log('OpenAI API Key:', this.openai.apiKey ? 'Present' : 'Missing');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful store assistant. Answer questions about products, orders, and store information in a friendly way.'
          },
          ...messages
        ],
        max_tokens: 150
      });

      return response.choices[0].message;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return {
        content: 'I\'m here to help with your store questions. What would you like to know about products or orders?'
      };
    }
  }
}

export default OpenAIService;