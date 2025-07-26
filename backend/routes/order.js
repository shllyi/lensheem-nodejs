const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order');
const { updateOrderStatus } = require('../controllers/order');

// Test route to verify server is working
router.get('/test', (req, res) => {
  res.json({ message: 'Order routes are working!' });
});

// Test email with PDF receipt
router.post('/test-email', async (req, res) => {
  try {
    const sendEmail = require('../utils/sendEmail');
    const { generateReceiptPDF } = require('../utils/generateReceipt');
    
    // Sample order data for testing
    const testOrderData = {
      orderinfo_id: 999,
      date_placed: new Date(),
      status: 'Pending',
      region: 'North America',
      rate: 15.99,
      items: [
        { item_name: 'Test Product 1', price: 29.99, quantity: 2 },
        { item_name: 'Test Product 2', price: 19.99, quantity: 1 }
      ]
    };

    await sendEmail({
      email: 'test@example.com', // Replace with actual test email
      subject: 'Test Email with PDF Receipt - LenSheem',
      type: 'orderStatus',
      data: {
        name: 'Test Customer',
        orderId: 999,
        newStatus: 'Pending'
      },
      attachReceipt: true,
      orderData: testOrderData
    });

    res.json({ success: true, message: 'Test email sent successfully!' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, message: 'Test email failed', error: error.message });
  }
});

// Create a new order
router.post('/', orderController.createOrder);

// Admin routes (specific routes first)
router.get('/admin/all', orderController.getAllOrders);

// Get orders by customer ID
router.get('/customer/:customerId', orderController.getOrdersByCustomer);

// Get shipping options (you can add this here or separate shipping routes)
router.get('/shipping', orderController.getShippingOptions);

// Status update routes (specific routes before generic ones)
router.put('/:orderId/status', orderController.updateOrderStatus);

// Fallback GET route for browser-based testing
router.get('/:orderId/status/:newStatus', orderController.updateOrderStatusGet);

// Get single order by ID (generic route last)
router.get('/:orderId', orderController.getOrderById);



module.exports = router;