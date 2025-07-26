const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category');

// Put static/specific routes before dynamic ones
router.get('/admin/all', categoryController.getAllCategoriesWithDeleted);

router.get('/', categoryController.getAllCategories);
router.post('/', categoryController.createCategory);
router.put('/restore/:id', categoryController.restoreCategory);
router.get('/:id', categoryController.getSingleCategory);
router.put('/:id', categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;