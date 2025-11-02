import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Dashboard = () => {
  const [shopData, setShopData] = useState(null)
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const fetchShopData = async () => {
      try {
        const shopDomain = localStorage.getItem('shop_domain')
        if (!shopDomain) {
          navigate('/login')
          return
        }

        const response = await fetch('/api/shop-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shop: shopDomain }),
        })

        const data = await response.json()
        if (response.ok) {
          setShopData(data.shop)
          setProducts(data.products || [])
          setCustomers(data.customers || [])
          setOrders(data.orders || [])
        } else {
          throw new Error(data.error || 'Failed to fetch shop data')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchShopData()
  }, [navigate])

  const handleDisconnect = () => {
    localStorage.removeItem('shop_domain')
    navigate('/login')
  }



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your store data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-blue-700">Aladdyn</h1>
            {shopData && (
              <div className="text-sm text-slate-600">
                Connected to: <span className="font-medium">{shopData.name}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleDisconnect}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Disconnect
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Store Info */}
        {shopData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Store Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-600">Store Name</p>
                <p className="font-medium">{shopData.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Domain</p>
                <p className="font-medium">{shopData.domain}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-medium">{shopData.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Products */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              Products ({products.length})
            </h2>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                </svg>
              </div>
              <p className="text-slate-600">No products found in your store</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-slate-100 rounded-lg mb-4 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image.src}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-slate-800 mb-2 line-clamp-2">
                    {product.title}
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-green-600">
                      ${product.variants?.[0]?.price || '0.00'}
                    </span>
                    <span className="text-sm text-slate-500">
                      {product.variants?.length || 0} variant{product.variants?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {product.vendor && (
                    <p className="text-sm text-slate-500 mt-2">by {product.vendor}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            Orders ({orders.length})
          </h2>

          {orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-600">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Order</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Total</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Payment status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Items</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Delivery status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-700">Delivery method</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    let customerName = 'Guest'

                    if (order.customer) {
                      // First try to find customer in customers array
                      const customerDetails = customers.find(c => c.id === order.customer.id)

                      if (customerDetails && (customerDetails.first_name || customerDetails.last_name)) {
                        customerName = `${customerDetails.first_name || ''} ${customerDetails.last_name || ''}`.trim()
                      } else if (customerDetails && customerDetails.email) {
                        customerName = customerDetails.email
                      } else if (order.customer.first_name || order.customer.last_name) {
                        customerName = `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
                      } else if (order.customer.email) {
                        customerName = order.customer.email
                      } else {
                        customerName = `Customer #${order.customer.id}`
                      }
                    }
                    const isToday = new Date(order.created_at).toDateString() === new Date().toDateString()
                    const timeStr = new Date(order.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                    const dateStr = isToday ? `Today at ${timeStr}` : new Date(order.created_at).toLocaleDateString()

                    return (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-medium text-blue-600">#{order.order_number || order.name}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{dateStr}</td>
                        <td className="py-3 px-4 text-sm">{customerName}</td>
                        <td className="py-3 px-4 font-medium">${order.total_price}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.financial_status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.financial_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                            {order.financial_status?.charAt(0).toUpperCase() + order.financial_status?.slice(1) || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{order.line_items?.length || 0} item{order.line_items?.length !== 1 ? 's' : ''}</td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {order.fulfillment_status ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.fulfillment_status === 'fulfilled' ? 'bg-green-100 text-green-800' :
                              order.fulfillment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                              {order.fulfillment_status.charAt(0).toUpperCase() + order.fulfillment_status.slice(1)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {order.shipping_lines && order.shipping_lines.length > 0 ?
                            order.shipping_lines[0].title :
                            order.line_items?.some(item => item.requires_shipping === false) ?
                              'Shipping not required' : 'Shipping'
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Chat with Genie Button */}
          <div className="flex justify-center mt-8">
            <button
              onClick={() => navigate('/chat')}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              <span>Chat with Genie</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Dashboard