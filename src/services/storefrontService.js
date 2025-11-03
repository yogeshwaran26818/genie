// Storefront chatbot service
export const createStorefrontChatbot = async (shop, accessToken) => {
  const scriptTagPayload = {
    script_tag: {
      event: 'onload',
      src: `https://your-app-domain.com/storefront-chatbot.js?shop=${shop}`,
      display_scope: 'online_store'
    }
  }

  const response = await fetch(`https://${shop}/admin/api/2025-07/script_tags.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(scriptTagPayload)
  })

  return response.json()
}

export const removeStorefrontChatbot = async (shop, accessToken, scriptTagId) => {
  const response = await fetch(`https://${shop}/admin/api/2025-07/script_tags/${scriptTagId}.json`, {
    method: 'DELETE',
    headers: {
      'X-Shopify-Access-Token': accessToken
    }
  })

  return response.ok
}