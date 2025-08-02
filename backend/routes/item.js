const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item');
const upload = require('../middlewares/upload');
const { requireAdminAuth } = require('../middlewares/adminAuth');

// PUBLIC ROUTES
router.get('/', itemController.getAllItems);
router.get('/category/:categoryId', itemController.getItemsByCategory);
router.get('/search/:term', itemController.searchItems);
router.get('/autocomplete', itemController.getAutocompleteSuggestions);

// ADMIN ROUTES - require admin authentication
router.get('/admin', requireAdminAuth, itemController.getAllItemsIncludingDeleted);
router.get('/admin/:id', requireAdminAuth, itemController.getSingleItem);

// CREATE (single image)
// item.js (routes)
router.post('/admin', requireAdminAuth, upload.array('images', 5), itemController.createItem);

// UPDATE (multiple images)
router.put('/admin/:id', requireAdminAuth, upload.array('images', 5), itemController.updateItem);

router.delete('/admin/:id', requireAdminAuth, itemController.deleteItem);
//restore
router.patch('/admin/restore/:id', requireAdminAuth, itemController.restoreItem);
router.get('/admin/all', requireAdminAuth, itemController.getAllItemsIncludingDeleted);



module.exports = router;