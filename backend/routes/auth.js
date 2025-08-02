const express = require('express');
const router = express.Router();
const { requireAuth, requireAdminAuth } = require('../middlewares/adminAuth');
const db = require('../config/database');

// Route to check if user is authenticated
router.get('/check', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'User is authenticated',
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to check if user is admin
router.get('/admin-check', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'User is admin',
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to get current user info
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to get admin profile information
router.get('/admin-profile', requireAdminAuth, (req, res) => {
  const userId = req.user.id;
  
  const sql = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.created_at,
      c.customer_id,
      c.title,
      c.fname,
      c.lname,
      c.addressline,
      c.town,
      c.phone,
      c.image_path
    FROM users u
    LEFT JOIN customer c ON u.id = c.user_id
    WHERE u.id = ? AND u.deleted_at IS NULL
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log('Database error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to fetch admin profile' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin profile not found' 
      });
    }

    const profile = results[0];
    
    // Format the response
    const adminProfile = {
      id: profile.id,
      name: profile.name || `${profile.fname || ''} ${profile.lname || ''}`.trim() || 'Admin User',
      email: profile.email,
      role: profile.role,
      status: profile.status,
      created_at: profile.created_at,
      customer_id: profile.customer_id,
      title: profile.title,
      fname: profile.fname,
      lname: profile.lname,
      addressline: profile.addressline,
      town: profile.town,
      phone: profile.phone,
      image_path: profile.image_path,
      // Generate initials for avatar
      initials: profile.fname && profile.lname 
        ? `${profile.fname.charAt(0)}${profile.lname.charAt(0)}`.toUpperCase()
        : profile.name 
        ? profile.name.charAt(0).toUpperCase()
        : 'A'
    };

    return res.status(200).json({ 
      success: true, 
      profile: adminProfile 
    });
  });
});

// Route to update admin profile
router.put('/admin-profile', requireAdminAuth, (req, res) => {
  const userId = req.user.id;
  const { name, email, fname, lname, phone, addressline, town } = req.body;

  // Start a transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ 
        success: false,
        message: 'Failed to start transaction' 
      });
    }

    // Update users table
    const updateUserSql = 'UPDATE users SET name = ?, email = ? WHERE id = ?';
    db.query(updateUserSql, [name, email, userId], (err, result) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({ 
            success: false,
            message: 'Failed to update user information' 
          });
        });
      }

      // Update customer table
      const updateCustomerSql = `
        UPDATE customer 
        SET fname = ?, lname = ?, phone = ?, addressline = ?, town = ?
        WHERE user_id = ?
      `;
      db.query(updateCustomerSql, [fname, lname, phone, addressline, town, userId], (err, result) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ 
              success: false,
              message: 'Failed to update customer information' 
            });
          });
        }

        // Commit transaction
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ 
                success: false,
                message: 'Failed to commit changes' 
              });
            });
          }

          res.json({ 
            success: true,
            message: 'Profile updated successfully' 
          });
        });
      });
    });
  });
});

module.exports = router; 