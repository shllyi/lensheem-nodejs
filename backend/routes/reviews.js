const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviews');
const upload = require('../middlewares/upload');
const { isAuthenticatedUser } = require('../middlewares/auth');
const { requireAdminAuth, requireAuth } = require('../middlewares/adminAuth');

// Test endpoint
router.get('/test', reviewController.testConnection);

router.post('/create', upload.array('images', 5), reviewController.createReview);
router.get('/customer/:id', reviewController.getReviewsByCustomer); 
router.get('/exists', reviewController.checkReviewExists);
router.get('/item/:item_id', reviewController.getReviewsByItem);

// Admin routes - must come before the generic :review_id route - require admin authentication
router.get('/admin', requireAdminAuth, reviewController.getAllReviewsForAdmin);
router.get('/admin/:review_id', requireAdminAuth, reviewController.getReviewForAdmin);
router.delete('/admin/:review_id', requireAdminAuth, reviewController.softDeleteReview);
router.patch('/admin/restore/:review_id', requireAdminAuth, reviewController.restoreReview);

// Generic routes - must come after specific routes
router.get('/:review_id', reviewController.getReviewById); 
router.put('/:review_id', isAuthenticatedUser, reviewController.updateReview);
router.delete('/:review_id', reviewController.deleteReview);

module.exports = router;