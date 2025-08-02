const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category');
const { requireAdminAuth } = require('../middlewares/adminAuth');

// Put static/specific routes before dynamic ones
router.get('/admin/all', requireAdminAuth, categoryController.getAllCategoriesWithDeleted);

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getSingleCategory);

// Admin routes - require admin authentication
router.post('/', requireAdminAuth, categoryController.createCategory);
router.put('/restore/:id', requireAdminAuth, categoryController.restoreCategory);
router.put('/:id', requireAdminAuth, categoryController.updateCategory);
router.delete('/:id', requireAdminAuth, categoryController.deleteCategory);

module.exports = router;