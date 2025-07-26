const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const { isAuthenticatedUser } = require('../middlewares/auth');
const db = require('../config/database'); // or your connection variable

const {
  registerUser,
  loginUser,
  updateUser,
  deactivateUser,
  getCustomerProfile,
  getAllUsers,
  getUserById,
  createUser,
  updateUserAdmin,
  updateUserRole,
  updateUserStatus
} = require('../controllers/user');

// Admin user management routes
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.post('/users', createUser);
router.put('/users/:id', updateUserAdmin);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/status', updateUserStatus);

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
