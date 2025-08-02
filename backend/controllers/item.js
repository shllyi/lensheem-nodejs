const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// --------------------
// PUBLIC ENDPOINTS
// --------------------

// Get all items for public view
const getAllItems = (req, res) => {
  const sql = `
    SELECT 
      i.item_id, 
      i.item_name, 
      i.sell_price, 
      i.image AS main_image,
      GROUP_CONCAT(ii.image_path) AS extra_images
    FROM item i
    LEFT JOIN item_images ii ON i.item_id = ii.item_id
    WHERE i.deleted_at IS NULL
      AND i.category_id IN (
        SELECT category_id FROM category WHERE deleted_at IS NULL
      )
    GROUP BY i.item_id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(' SQL Error:', err.message);
      return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }

    const formatted = results.map(row => {
      const extra = row.extra_images ? row.extra_images.split(',') : [];
      const all = [row.main_image, ...extra].filter(Boolean);
      return {
        item_id: row.item_id,
        item_name: row.item_name,
        sell_price: row.sell_price,
        images: all
      };
    });

    res.json({ status: 'success', data: formatted });
  });
};

// Get items by category (public)
const getItemsByCategory = (req, res) => {
  const categoryId = req.params.categoryId;

  const sql = `
    SELECT 
      i.item_id, 
      i.item_name, 
      i.sell_price, 
      i.image AS main_image,
      GROUP_CONCAT(ii.image_path) AS extra_images
    FROM item i
    LEFT JOIN item_images ii ON i.item_id = ii.item_id
    WHERE i.deleted_at IS NULL 
      AND i.category_id = ? 
      AND i.category_id IN (
        SELECT category_id FROM category WHERE deleted_at IS NULL
      )
    GROUP BY i.item_id
  `;

  db.query(sql, [categoryId], (err, results) => {
    if (err) {
      console.error('❌ SQL Error:', err.message);
      return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }

    const formatted = results.map(row => {
      const extra = row.extra_images ? row.extra_images.split(',') : [];
      const all = [row.main_image, ...extra].filter(Boolean);
      return {
        item_id: row.item_id,
        item_name: row.item_name,
        sell_price: row.sell_price,
        images: all
      };
    });

    res.json({ status: 'success', data: formatted });
  });
};

// --------------------
// ADMIN FUNCTIONS
// --------------------

// Get all items with stock and category
const getAllItemsWithStock = (req, res) => {
  const sql = `
    SELECT 
      i.item_id,
      i.item_name,
      i.description,
      i.cost_price,
      i.sell_price,
      i.image AS main_image,
      GROUP_CONCAT(ii.image_path) AS extra_images,
      i.category_id,
      i.created_at,
      i.updated_at,
      s.quantity,
      c.description AS category_name
    FROM item i
    INNER JOIN stock s ON i.item_id = s.item_id
    LEFT JOIN category c ON i.category_id = c.category_id
    LEFT JOIN item_images ii ON i.item_id = ii.item_id
    WHERE i.deleted_at IS NULL AND (c.deleted_at IS NULL OR c.category_id IS NULL)
    GROUP BY i.item_id
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err });

    const formatted = rows.map(row => {
      const extra = row.extra_images ? row.extra_images.split(',').filter(Boolean) : [];
      const all = [row.main_image, ...extra].filter(Boolean);
      return {
        ...row,
        image: all[0] || null,
        all_images: all
      };
    });

    return res.status(200).json({ data: formatted });
  });
};

// Get single item
const getSingleItem = (req, res) => {
  const sql = `
    SELECT i.*, s.quantity, GROUP_CONCAT(ii.image_path) AS extra_images
    FROM item i
    INNER JOIN stock s ON i.item_id = s.item_id
    LEFT JOIN item_images ii ON i.item_id = ii.item_id
    WHERE i.item_id = ?
    GROUP BY i.item_id
  `;
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err });

    const item = result[0];
    const extra = item.extra_images ? item.extra_images.split(',').filter(Boolean) : [];
    const all = [item.image, ...extra].filter(Boolean);
    item.all_images = all;

    return res.status(200).json({ success: true, result: [item] });
  });
};

// Create item
const createItem = (req, res) => {
  const { item_name, description, cost_price, sell_price, quantity, category_id } = req.body;
  const imageFiles = req.files || [];
  const mainImage = imageFiles.length > 0 ? imageFiles[0].filename : null;
  
  if (!item_name || !description || !cost_price || !sell_price || !quantity || !category_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const itemSql = `
    INSERT INTO item (item_name, description, cost_price, sell_price, image, category_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const itemValues = [item_name, description, cost_price, sell_price, mainImage, category_id];

  db.execute(itemSql, itemValues, (err, result) => {
    if (err) return res.status(500).json({ error: 'Error inserting item', details: err });

    const itemId = result.insertId;

    const stockSql = `INSERT INTO stock (item_id, quantity) VALUES (?, ?)`;
    db.execute(stockSql, [itemId, quantity], (err2) => {
      if (err2) return res.status(500).json({ error: 'Error inserting stock', details: err2 });

      // Only insert into item_images if more than one image is provided
      if (imageFiles.length > 1) {
        // Insert all images except the first (main image)
        const imgSql = `INSERT INTO item_images (item_id, image_path) VALUES ?`;
        const imgValues = imageFiles.slice(1).map(file => [itemId, file.filename]);
        db.query(imgSql, [imgValues], (err3) => {      
          if (err3) return res.status(500).json({ error: 'Error saving image path', details: err3 });
          return res.status(201).json({ success: true, message: 'Item created with images', itemId });
        });
      } else {
        return res.status(201).json({ success: true, message: 'Item created', itemId });
      }
    });
  });
};


// Update item
const updateItem = (req, res) => {
  const itemId = req.params.id;
  const { item_name, description, cost_price, sell_price, quantity, category_id } = req.body;
  const imageFiles = req.files || [];

  function deleteOldImagesAndProceed(callback) {
    // Always delete all old images when new images are uploaded
    if (imageFiles.length > 0) {
      const getOldSql = `SELECT image, (SELECT GROUP_CONCAT(image_path) FROM item_images WHERE item_id = ?) AS extra_images FROM item WHERE item_id = ?`;
      db.query(getOldSql, [itemId, itemId], (err, results) => {
        if (err) return callback(err);
        if (!results[0]) return callback();
        const oldMain = results[0].image;
        const oldExtras = results[0].extra_images ? results[0].extra_images.split(',') : [];
        const allOld = [oldMain, ...oldExtras].filter(Boolean);
        
        // Delete all old image files from filesystem
        allOld.forEach(filename => {
          const filePath = path.join(__dirname, '../public/uploads/', filename);
          fs.unlink(filePath, err => {
            if (err && err.code !== 'ENOENT') {
              console.error('Error deleting old image:', err);
            }
          });
        });
        callback();
      });
    } else {
      callback();
    }
  }

  deleteOldImagesAndProceed(() => {
    let itemSql, itemValues;
    if (imageFiles.length > 0) {
      itemSql = `
        UPDATE item
        SET item_name = ?, description = ?, cost_price = ?, sell_price = ?, category_id = ?, image = ?
        WHERE item_id = ?
      `;
      itemValues = [item_name, description, cost_price, sell_price, category_id, imageFiles[0].filename, itemId];
    } else {
      itemSql = `
        UPDATE item
        SET item_name = ?, description = ?, cost_price = ?, sell_price = ?, category_id = ?
        WHERE item_id = ?
      `;
      itemValues = [item_name, description, cost_price, sell_price, category_id, itemId];
    }

    db.execute(itemSql, itemValues, (err) => {
      if (err) return res.status(500).json({ error: 'Error updating item', details: err });

      const stockSql = `UPDATE stock SET quantity = ? WHERE item_id = ?`;
      db.execute(stockSql, [quantity, itemId], (err2) => {
        if (err2) return res.status(500).json({ error: 'Error updating stock', details: err2 });

        if (imageFiles.length > 0) {
          // Always clear all old extra images first
          const deleteSql = `DELETE FROM item_images WHERE item_id = ?`;
          db.query(deleteSql, [itemId], (delErr) => {
            if (delErr) return res.status(500).json({ error: 'Error deleting old images', details: delErr });

            if (imageFiles.length === 1) {
              // Only one image: do NOT insert into item_images, only set main image
              return res.status(200).json({ success: true, message: 'Item updated with single image' });
            } else {
              // Multiple images: insert all except the first one into item_images
              // The first image is already set as the main image in the item table
              const extraImages = imageFiles.slice(1); // Skip the first image
              if (extraImages.length > 0) {
                const imgSql = `INSERT INTO item_images (item_id, image_path) VALUES ?`;
                const imgValues = extraImages.map(file => [itemId, file.filename]);
                db.query(imgSql, [imgValues], (err3) => {
                  if (err3) return res.status(500).json({ error: 'Error saving extra images', details: err3 });
                  return res.status(200).json({ success: true, message: 'Item updated with new images' });
                });
              } else {
                return res.status(200).json({ success: true, message: 'Item updated with new images' });
              }
            }
          });
        } else {
          return res.status(200).json({ success: true, message: 'Item updated' });
        }
      });
    });
  });
};



// Delete item
// Soft delete item
const softDeleteItem = (req, res) => {
  const itemId = req.params.id;
  const sql = `UPDATE item SET deleted_at = NOW() WHERE item_id = ?`;

  db.execute(sql, [itemId], (err) => {
    if (err) return res.status(500).json({ error: 'Error soft deleting item', details: err });
    return res.status(200).json({ success: true, message: 'Item soft deleted' });
  });
};

const restoreItem = (req, res) => {
  const itemId = req.params.id;
  const sql = `UPDATE item SET deleted_at = NULL WHERE item_id = ?`;

  db.execute(sql, [itemId], (err) => {
    if (err) return res.status(500).json({ error: 'Error restoring item', details: err });
    return res.status(200).json({ success: true, message: 'Item restored' });
  });
};
const getAllItemsIncludingDeleted = (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;
  let offset = (page - 1) * limit;

  // Get total count
  const countSql = `SELECT COUNT(*) as total FROM item`;
  db.query(countSql, (err, countResult) => {
    if (err) return res.status(500).json({ error: 'Database error', details: err });
    const total = countResult[0].total;

    // Get paginated item IDs first
    const idSql = `SELECT item_id FROM item ORDER BY item_id LIMIT ? OFFSET ?`;
    db.query(idSql, [limit, offset], (err, idRows) => {
      if (err) return res.status(500).json({ error: 'Database error', details: err });
      if (idRows.length === 0) return res.status(200).json({ data: [], total });

      const ids = idRows.map(row => row.item_id);
      // Now get the full data for these IDs
      const sql = `
        SELECT 
          i.*, s.quantity, 
          GROUP_CONCAT(ii.image_path) AS extra_images,
          c.description AS category_name
        FROM item i
        LEFT JOIN stock s ON i.item_id = s.item_id
        LEFT JOIN category c ON i.category_id = c.category_id
        LEFT JOIN item_images ii ON i.item_id = ii.item_id
        WHERE i.item_id IN (?)
        GROUP BY i.item_id
        ORDER BY i.item_id
      `;
      db.query(sql, [ids], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err });

        const formatted = rows.map(row => {
          const extra = row.extra_images ? row.extra_images.split(',') : [];
          const all = [row.image, ...extra].filter(Boolean);
          return {
            ...row,
            image: all[0] || null,
            all_images: all
          };
        });

        return res.status(200).json({ data: formatted, total });
      });
    });
  });
};

// Search items by name
const searchItems = (req, res) => {
  const { term } = req.params;
  const sql = `
    SELECT 
      i.item_id, 
      i.item_name, 
      i.sell_price, 
      i.image AS main_image, 
      GROUP_CONCAT(ii.image_path) AS extra_images
    FROM item i
    LEFT JOIN item_images ii ON i.item_id = ii.item_id
    WHERE i.item_name LIKE ? AND i.deleted_at IS NULL
    GROUP BY i.item_id
  `;

  const searchTerm = `%${term}%`;

  db.execute(sql, [searchTerm], (err, results) => {
    if (err) {
      console.error(" Search SQL Error:", err.message);
      return res.status(500).json({ status: 'error', message: err.message });
    }

    const formatted = results.map(row => {
      const extra = row.extra_images ? row.extra_images.split(',') : [];
      const all = [row.main_image, ...extra].filter(Boolean); // merge and remove empty
      return {
        item_id: row.item_id,
        item_name: row.item_name,
        sell_price: row.sell_price,
        images: all
      };
    });

    return res.status(200).json({ status: 'success', data: formatted });
  });
};

// Autocomplete suggestions for search
const getAutocompleteSuggestions = (req, res) => {
  const { term } = req.query;
  
  if (!term || term.trim().length < 2) {
    return res.status(200).json({ status: 'success', data: [] });
  }

  const sql = `
    SELECT 
      i.item_id, 
      i.item_name, 
      i.sell_price, 
      i.image AS main_image
    FROM item i
    WHERE i.item_name LIKE ? AND i.deleted_at IS NULL
    ORDER BY i.item_name
    LIMIT 10
  `;

  const searchTerm = `%${term.trim()}%`;

  db.execute(sql, [searchTerm], (err, results) => {
    if (err) {
      console.error("Autocomplete SQL Error:", err.message);
      return res.status(500).json({ status: 'error', message: err.message });
    }

    const suggestions = results.map(row => ({
      id: row.item_id,
      label: row.item_name,
      value: row.item_name,
      price: row.sell_price,
      image: row.main_image
    }));

    return res.status(200).json({ status: 'success', data: suggestions });
  });
};


module.exports = {
  getAllItems,
  getItemsByCategory,
  getAllItemsWithStock,
  getSingleItem,
  createItem,
  updateItem,
  deleteItem: softDeleteItem, // soft delete
  restoreItem ,
  getAllItemsIncludingDeleted,
  searchItems,                // new
  getAutocompleteSuggestions  // autocomplete
};
