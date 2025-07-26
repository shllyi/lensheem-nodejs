const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order');
const { updateOrderStatus } = require('../controllers/order');

// Create a new order
router.post('/', orderController.createOrder);

router.get('/admin/all', orderController.getAllOrders);

// Get orders by customer ID
router.get('/customer/:customerId', orderController.getOrdersByCustomer);

// Get shipping options (you can add this here or separate shipping routes)
router.get('/shipping', orderController.getShippingOptions);

// Get single order by ID
router.get('/:orderId', orderController.getOrderById);

router.put('/:orderId/status', orderController.updateOrderStatus);

// Fallback GET route for browser-based testing
router.get('/:orderId/status/:newStatus', orderController.updateOrderStatusGet);



module.exports = router;