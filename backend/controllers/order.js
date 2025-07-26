const db = require('../config/database'); 
const sendEmail = require('../utils/sendEmail'); // ✅ correct import

// 🚚 Get all shipping options
const getShippingOptions = (req, res) => {
  const sql = `SELECT shipping_id, region, rate FROM shipping`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching shipping options:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, data: results });
  });
};

// 🧾 Create an order
const createOrder = (req, res) => {
  const { customer_id, shipping_id, items } = req.body;
  // Always use server time and default status
  const date_placed = new Date();
  const status = 'Pending';

  if (!customer_id || !shipping_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or invalid order data' });
  }

  // Start a transaction
  db.beginTransaction(err => {
    if (err) {
      console.error('Transaction error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Insert into orderinfo
    const orderInfoSql = `
      INSERT INTO orderinfo (customer_id, date_placed, shipping_id, status)
      VALUES (?, ?, ?, ?)
    `;

    db.query(orderInfoSql, [customer_id, date_placed, shipping_id, status], (err, result) => {
      if (err) {
        return db.rollback(() => {
          console.error('Insert orderinfo error:', err);
          res.status(500).json({ success: false, message: 'Failed to create order' });
        });
      }

      const orderinfo_id = result.insertId;

      // Prepare orderline inserts
      const orderlines = items.map(item => [orderinfo_id, item.id, item.quantity]);

      const orderlineSql = 'INSERT INTO orderline (orderinfo_id, item_id, quantity) VALUES ?';

      db.query(orderlineSql, [orderlines], (err) => {
        if (err) {
          return db.rollback(() => {
            console.error('Insert orderline error:', err);
            res.status(500).json({ success: false, message: 'Failed to add order items' });
          });
        }

        // Commit transaction
        db.commit(err => {
          if (err) {
            return db.rollback(() => {
              console.error('Commit error:', err);
              res.status(500).json({ success: false, message: 'Failed to finalize order' });
            });
          }

          // Send order confirmation email with receipt
          sendOrderConfirmationEmail(orderinfo_id, customer_id, items);

          res.json({ success: true, message: 'Order created', orderinfo_id });
        });
      });
    });
  });
};

// Placeholder if you have this in your project
const getOrdersByCustomer = (req, res) => {
    const customerId = req.params.customerId;

    // Get orders + shipping info
    const sql = `
      SELECT 
        o.orderinfo_id,
        o.date_placed,
        o.status,
        s.region,
        s.rate
      FROM orderinfo o
      JOIN shipping s ON o.shipping_id = s.shipping_id
      WHERE o.customer_id = ?
      ORDER BY o.date_placed DESC
    `;
  
    db.query(sql, [customerId], (err, orders) => {
      if (err) {
        console.error("Error fetching orders:", err);
        return res.status(500).json({ success: false, message: "Error fetching orders" });
      }
  
      if (!orders.length) {
        return res.json({ success: true, data: [] });
      }
  
      // Get all order lines for these orders
      const orderIds = orders.map(o => o.orderinfo_id);
      const placeholders = orderIds.map(() => '?').join(',');
  
      const itemSql = `
        SELECT 
          ol.orderinfo_id,
          i.item_name,
          i.sell_price AS price,
          ol.quantity
        FROM orderline ol
        JOIN item i ON i.item_id = ol.item_id
        WHERE ol.orderinfo_id IN (${placeholders})
      `;
  
      db.query(itemSql, [...orderIds], (err, orderItems) => {
        if (err) {
          console.error("Error fetching order items:", err);
          return res.status(500).json({ success: false, message: "Error fetching items" });
        }
  
        // Group items by orderinfo_id
        const grouped = {};
        orderItems.forEach(item => {
          if (!grouped[item.orderinfo_id]) grouped[item.orderinfo_id] = [];
          grouped[item.orderinfo_id].push({
            item_name: item.item_name,
            quantity: item.quantity,
            price: item.price
          });
        });
  
        // Attach items to orders
        const final = orders.map(order => ({
          ...order,
          items: grouped[order.orderinfo_id] || []
        }));
  
        res.json({ success: true, data: final });
      });
    });
  };

  const updateOrderStatus = (req, res) => {
    const { orderId } = req.params;
    const { newStatus } = req.body;
    
    console.log('=== UPDATE ORDER STATUS CALLED ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Updating order status:', { orderId, newStatus });
  
    const sql = `UPDATE orderinfo SET status = ? WHERE orderinfo_id = ?`;
    db.query(sql, [newStatus, orderId], (err, updateResult) => {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
  
      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ message: 'Order not found.' });
      }
  
            // Get complete order data for email and PDF receipt
      const getOrderDataSql = `
        SELECT 
          u.email, 
          u.name, 
          o.orderinfo_id,
          o.date_placed,
          o.status,
          s.region,
          s.rate
        FROM orderinfo o
        LEFT JOIN customer c ON o.customer_id = c.customer_id
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN shipping s ON o.shipping_id = s.shipping_id
        WHERE o.orderinfo_id = ?
      `;

      db.query(getOrderDataSql, [orderId], async (err, results) => {
        if (err) {
          console.error('Fetch order data error:', err);
          return res.json({ success: true, message: 'Order updated successfully, but email notification failed.' });
        }

        console.log('Order data lookup results for order', orderId, ':', results);

        if (results.length === 0 || !results[0].email) {
          console.log('User not found or no email for order:', orderId);
          return res.json({ success: true, message: 'Order updated successfully, but email notification failed.' });
        }

        const { email, name, date_placed, region, rate } = results[0];

        // Get order items for PDF receipt
        const getItemsSql = `
          SELECT 
            i.item_name,
            i.sell_price AS price,
            ol.quantity
          FROM orderline ol
          JOIN item i ON i.item_id = ol.item_id
          WHERE ol.orderinfo_id = ?
        `;

        db.query(getItemsSql, [orderId], async (err, items) => {
          if (err) {
            console.error('Fetch items error:', err);
            // Continue without items for PDF
          }

          // Prepare order data for PDF receipt
          const orderData = {
            orderinfo_id: orderId,
            date_placed,
            status: newStatus,
            region,
            rate,
            items: items || []
          };

          try {
            await sendEmail({
              email,
              subject: `Your Order #${orderId} Status Updated`,
              type: 'orderStatus',
              data: {
                name: name || 'Customer',
                orderId: orderId,
                newStatus: newStatus
              },
              attachReceipt: true,
              orderData: orderData
            });

            res.json({ success: true, message: 'Order updated and email with receipt sent successfully.' });
          } catch (emailErr) {
            console.error('Email failed:', emailErr);
            res.json({ success: true, message: 'Order updated successfully, but email notification failed.' });
          }
        });
      });
    });
  };
  

  const updateOrderStatusGet = async (req, res) => {
    const { orderId, newStatus } = req.params;
  
    // Reuse the existing logic by injecting into req.body
    req.body = { newStatus };
    return updateOrderStatus(req, res);
  };
  

// Get single order by ID with detailed information
const getOrderById = (req, res) => {
  const orderId = req.params.orderId;
  console.log('Getting order by ID:', orderId);

  // Get order info with shipping details
  const orderSql = `
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
    WHERE o.orderinfo_id = ?
  `;

  db.query(orderSql, [orderId], (err, orderResult) => {
    if (err) {
      console.error("Error fetching order:", err);
      return res.status(500).json({ success: false, message: "Error fetching order" });
    }

    console.log('Order result:', orderResult);

    if (orderResult.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = orderResult[0];

    // Get order items with images
    const itemSql = `
      SELECT 
        ol.orderinfo_id,
        ol.item_id,
        ol.quantity,
        i.item_name,
        i.sell_price AS price,
        i.image
      FROM orderline ol
      JOIN item i ON i.item_id = ol.item_id
      WHERE ol.orderinfo_id = ?
    `;

    db.query(itemSql, [orderId], (err, itemResult) => {
      if (err) {
        console.error("Error fetching order items:", err);
        return res.status(500).json({ success: false, message: "Error fetching items" });
      }

      console.log('Item result:', itemResult);

      // Process items to include all images
      const items = itemResult.map(item => {
        return {
          item_id: item.item_id,
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
          all_images: item.image ? [item.image] : []
        };
      });

      const finalOrder = {
        ...order,
        items: items
      };

      console.log('Final order:', finalOrder);
      res.json({ success: true, data: finalOrder });
    });
  });
};

// ADMIN: Get all orders with search and pagination
const getAllOrders = (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    orderId, 
    customerId, 
    status, 
    dateFrom, 
    dateTo 
  } = req.query;

  // Build WHERE clause for search filters
  let whereConditions = [];
  let queryParams = [];

  if (orderId) {
    whereConditions.push('o.orderinfo_id = ?');
    queryParams.push(orderId);
  }

  if (customerId) {
    whereConditions.push('o.customer_id = ?');
    queryParams.push(customerId);
  }

  if (status) {
    whereConditions.push('o.status = ?');
    queryParams.push(status);
  }

  if (dateFrom) {
    whereConditions.push('DATE(o.date_placed) >= ?');
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    whereConditions.push('DATE(o.date_placed) <= ?');
    queryParams.push(dateTo);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Calculate pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const limitClause = `LIMIT ${parseInt(limit)} OFFSET ${offset}`;

  // Get orders with search filters and pagination
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
    ${whereClause}
    ORDER BY o.date_placed DESC
    ${limitClause}
  `;

  console.log('Search Parameters:', { orderId, customerId, status, dateFrom, dateTo });
  console.log('SQL Query:', sql);
  console.log('Query Parameters:', queryParams);

  db.query(sql, queryParams, (err, orders) => {
    if (err) {
      console.error("Error fetching all orders:", err);
      return res.status(500).json({ success: false, message: "Error fetching orders" });
    }

    console.log('Orders found:', orders.length);
    console.log('First order sample:', orders[0]);
    console.log('Customer IDs in orders:', orders.map(o => o.customer_id));

    if (!orders.length) {
      return res.json({ success: true, data: [] });
    }

    // Get all order lines for these orders
    const orderIds = orders.map(o => o.orderinfo_id);
    const placeholders = orderIds.map(() => '?').join(',');

    const itemSql = `
      SELECT 
        ol.orderinfo_id,
        i.item_name,
        i.sell_price AS price,
        ol.quantity
      FROM orderline ol
      JOIN item i ON i.item_id = ol.item_id
      WHERE ol.orderinfo_id IN (${placeholders})
    `;

    db.query(itemSql, [...orderIds], (err, orderItems) => {
      if (err) {
        console.error("Error fetching order items:", err);
        return res.status(500).json({ success: false, message: "Error fetching items" });
      }

      // Group items by orderinfo_id
      const grouped = {};
      orderItems.forEach(item => {
        if (!grouped[item.orderinfo_id]) grouped[item.orderinfo_id] = [];
        grouped[item.orderinfo_id].push({
          item_name: item.item_name,
          quantity: item.quantity,
          price: item.price
        });
      });

      // Attach items to orders
      const final = orders.map(order => ({
        ...order,
        items: grouped[order.orderinfo_id] || []
      }));

      res.json({ success: true, data: final });
    });
  });
};

// Send order confirmation email with PDF receipt
const sendOrderConfirmationEmail = async (orderinfo_id, customer_id, items) => {
  try {
    // Get customer and order details
    const getOrderDataSql = `
      SELECT 
        u.email, 
        u.name, 
        o.orderinfo_id,
        o.date_placed,
        o.status,
        s.region,
        s.rate
      FROM orderinfo o
      LEFT JOIN customer c ON o.customer_id = c.customer_id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN shipping s ON o.shipping_id = s.shipping_id
      WHERE o.orderinfo_id = ?
    `;

    db.query(getOrderDataSql, [orderinfo_id], async (err, results) => {
      if (err || results.length === 0 || !results[0].email) {
        console.error('Failed to get order data for email:', err);
        return;
      }

      const { email, name, date_placed, status, region, rate } = results[0];

      // Get item details for PDF receipt
      const getItemsSql = `
        SELECT 
          i.item_name,
          i.sell_price AS price,
          ol.quantity
        FROM orderline ol
        JOIN item i ON i.item_id = ol.item_id
        WHERE ol.orderinfo_id = ?
      `;

      db.query(getItemsSql, [orderinfo_id], async (err, orderItems) => {
        if (err) {
          console.error('Failed to get items for email:', err);
        }

        // Prepare order data for PDF receipt
        const orderData = {
          orderinfo_id,
          date_placed,
          status,
          region,
          rate,
          items: orderItems || []
        };

        try {
          await sendEmail({
            email,
            subject: `Order Confirmation #${orderinfo_id} - LenSheem`,
            type: 'orderStatus',
            data: {
              name: name || 'Customer',
              orderId: orderinfo_id,
              newStatus: status
            },
            attachReceipt: true,
            orderData: orderData
          });

          console.log(`Order confirmation email sent for order #${orderinfo_id}`);
        } catch (emailErr) {
          console.error('Failed to send order confirmation email:', emailErr);
        }
      });
    });
  } catch (error) {
    console.error('Error in sendOrderConfirmationEmail:', error);
  }
};

module.exports = {
  createOrder,
  getOrdersByCustomer,
  getOrderById,
  getShippingOptions,
  updateOrderStatus,
  updateOrderStatusGet,
  getAllOrders
};