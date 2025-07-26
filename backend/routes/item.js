const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item');
const upload = require('../middlewares/upload');

// PUBLIC ROUTES
router.get('/', itemController.getAllItems);
router.get('/category/:categoryId', itemController.getItemsByCategory);
router.get('/search/:term', itemController.searchItems);

// ADMIN ROUTES
router.get('/admin', itemController.getAllItemsIncludingDeleted);
router.get('/admin/:id', itemController.getSingleItem);

// CREATE (single image)
// item.js (routes)
router.post('/admin', upload.array('images', 5), itemController.createItem);

// UPDATE (multiple images)
router.put('/admin/:id', upload.array('images', 5), itemController.updateItem);

router.delete('/admin/:id', itemController.deleteItem);
//restore
router.patch('/admin/restore/:id', itemController.restoreItem);
router.get('/admin/all', itemController.getAllItemsIncludingDeleted);



module.exports = router;