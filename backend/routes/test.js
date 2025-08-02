const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Test route to check user roles
router.get('/users', (req, res) => {
  const sql = 'SELECT id, name, email, role FROM users WHERE deleted_at IS NULL';
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: err.message 
      });
    }
    
    res.json({
      success: true,
      users: results,
      adminCount: results.filter(user => user.role && user.role.toLowerCase() === 'admin').length,
      userCount: results.filter(user => user.role && user.role.toLowerCase() === 'user').length
    });
  });
});

// Test route to check shipping regions
router.get('/shipping', (req, res) => {
  const sql = 'SELECT * FROM shipping';
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: err.message 
      });
    }
    
    res.json({
      success: true,
      shipping: results,
      count: results.length
    });
  });
});

// Test route to get all available regions for search
router.get('/regions', (req, res) => {
  const sql = 'SELECT DISTINCT region FROM shipping ORDER BY region';
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: err.message 
      });
    }
    
    res.json({
      success: true,
      regions: results.map(r => r.region),
      count: results.length
    });
  });
});

// Test route to check orders with shipping info
router.get('/orders', (req, res) => {
  const sql = `
    SELECT 
      o.orderinfo_id,
      o.customer_id,
      o.date_placed,
      o.date_shipped,
      o.date_delivered,
      o.status,
      s.region,
      s.rate
    FROM orderinfo o
    JOIN shipping s ON o.shipping_id = s.shipping_id
    LIMIT 5
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: err.message 
      });
    }
    
    res.json({
      success: true,
      orders: results,
      count: results.length
    });
  });
});

// Test route to insert sample order data
router.post('/insert-sample-orders', (req, res) => {
  // First, check if we have shipping regions
  db.query('SELECT * FROM shipping LIMIT 1', (err, shippingResults) => {
    if (err || shippingResults.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No shipping regions found. Please add shipping regions first.' 
      });
    }
    
    const shippingId = shippingResults[0].shipping_id;
    
    // Insert sample orders
    const sampleOrders = [
      {
        customer_id: 1,
        shipping_id: shippingId,
        date_placed: new Date().toISOString().slice(0, 19).replace('T', ' '),
        status: 'Pending'
      },
      {
        customer_id: 1,
        shipping_id: shippingId,
        date_placed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        date_shipped: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        status: 'Shipped'
      },
      {
        customer_id: 1,
        shipping_id: shippingId,
        date_placed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        date_shipped: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        date_delivered: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        status: 'Delivered'
      }
    ];
    
    let insertedCount = 0;
    let errorCount = 0;
    
    sampleOrders.forEach((order, index) => {
      const sql = `
        INSERT INTO orderinfo (customer_id, shipping_id, date_placed, date_shipped, date_delivered, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.query(sql, [
        order.customer_id,
        order.shipping_id,
        order.date_placed,
        order.date_shipped || null,
        order.date_delivered || null,
        order.status
      ], (err, result) => {
        if (err) {
          console.error('Error inserting sample order:', err);
          errorCount++;
        } else {
          insertedCount++;
        }
        
        // If this is the last order, send response
        if (index === sampleOrders.length - 1) {
          res.json({
            success: true,
            message: `Inserted ${insertedCount} sample orders, ${errorCount} errors`,
            insertedCount,
            errorCount
          });
        }
      });
    });
  });
});

// Test route to check specific user by email
router.get('/user/:email', (req, res) => {
  const { email } = req.params;
  const sql = 'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL';
  
  db.query(sql, [email], (err, results) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: err.message 
      });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: results[0]
    });
  });
});

module.exports = router; 