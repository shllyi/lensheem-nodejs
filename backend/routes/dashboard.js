const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard');
const { requireAdminAuth } = require('../middlewares/adminAuth');

// Dashboard routes for admin charts
router.get('/address-chart', requireAdminAuth, dashboardController.addressChart);
router.get('/sales-chart', requireAdminAuth, dashboardController.salesChart);
router.get('/items-chart', requireAdminAuth, dashboardController.itemsChart);

// Main dashboard stats route
router.get('/', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard access granted',
    charts: {
      addressChart: '/api/dashboard/address-chart',
      salesChart: '/api/dashboard/sales-chart',
      itemsChart: '/api/dashboard/items-chart'
    }
  });
});

module.exports = router;