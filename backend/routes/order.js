const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order');
const { updateOrderStatus } = require('../controllers/order');
const { requireAdminAuth, requireAuth, verifyAdminInDB } = require('../middlewares/adminAuth');

// Test route to verify server is working
router.get('/test', (req, res) => {
  res.json({ message: 'Order routes are working!' });
});

// Test email with PDF receipt - ADMIN ONLY
router.post('/test-email', requireAdminAuth, verifyAdminInDB, async (req, res) => {
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

// Create a new order - PUBLIC (but should be authenticated in production)
router.post('/', orderController.createOrder);

// ==================== ADMIN ROUTES (REQUIRE ADMIN AUTHENTICATION) ====================

// Get all orders with search and pagination - ADMIN ONLY
router.get('/admin/all', requireAdminAuth, verifyAdminInDB, orderController.getAllOrders);

// Update order status - ADMIN ONLY
router.put('/:orderId/status', requireAdminAuth, verifyAdminInDB, orderController.updateOrderStatus);

// Get order statistics - ADMIN ONLY
router.get('/admin/stats', requireAdminAuth, verifyAdminInDB, (req, res) => {
  // This would be implemented in the order controller
  res.json({ success: true, message: 'Order statistics endpoint - to be implemented' });
});

// Get order details for admin - ADMIN ONLY
router.get('/admin/:orderId', requireAdminAuth, verifyAdminInDB, orderController.getOrderById);

// ==================== USER ROUTES (REQUIRE USER AUTHENTICATION) ====================

// Get orders by customer ID - require authentication
router.get('/customer/:customerId', requireAuth, orderController.getOrdersByCustomer);

// Get single order by ID for authenticated user
router.get('/user/:orderId', requireAuth, orderController.getOrderById);

// ==================== PUBLIC ROUTES ====================

// Get shipping options (public route)
router.get('/shipping', orderController.getShippingOptions);

// Fallback GET route for browser-based testing - ADMIN ONLY
router.get('/:orderId/status/:newStatus', requireAdminAuth, verifyAdminInDB, orderController.updateOrderStatusGet);

// Get single order by ID (generic route last) - ADMIN ONLY
router.get('/:orderId', requireAdminAuth, verifyAdminInDB, orderController.getOrderById);

module.exports = router;