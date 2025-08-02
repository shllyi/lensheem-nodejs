const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const { isAuthenticatedUser } = require('../middlewares/auth');
const { requireAdminAuth, requireAuth } = require('../middlewares/adminAuth');
const db = require('../config/database'); // or your connection variable

const {
  registerUser,
  loginUser,
  updateUser,
  deactivateUser,
  getCustomerProfile,
  getAllUsers,
  getSingleUser,
  createAdmin,
  updateUserRole,
  updateUserStatus
} = require('../controllers/user');

// Admin user management routes - require admin authentication
router.get('/users', requireAdminAuth, getAllUsers);
router.get('/users/:id', requireAdminAuth, getSingleUser);
router.post('/users', requireAdminAuth, upload.single('image'), createAdmin);
router.put('/users/:id/role', requireAdminAuth, updateUserRole);
router.put('/users/:id/status', requireAdminAuth, updateUserStatus);

// Existing routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/update-profile', isAuthenticatedUser, upload.single('image'), updateUser);
router.delete('/deactivate', deactivateUser);
router.get('/customers/:userId', getCustomerProfile);

router.get('/customer/by-user/:userId', (req, res) => {
  const userId = req.params.userId;
  const sql = 'SELECT customer_id FROM customer WHERE user_id = ? LIMIT 1';
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false });
    if (results.length === 0) return res.json({ success: false });
    res.json({ success: true, customer_id: results[0].customer_id });
  });
});

module.exports = router;
