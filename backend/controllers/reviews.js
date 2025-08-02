const connection = require('../config/database');

exports.createReview = (req, res) => {
  const { orderinfo_id, customer_id, item_id, rating, review_text } = req.body;
  const images = req.files; // Multer will populate this

  console.log('Review submission data:', { orderinfo_id, customer_id, item_id, rating, review_text });
  console.log('Images:', images);
  console.log('Request body:', req.body);
  console.log('Request files:', req.files);

  if (!orderinfo_id || !customer_id || !item_id || !rating) {
    console.error('Missing required fields:', { orderinfo_id, customer_id, item_id, rating });
    return res.status(400).json({
      success: false,
      message: "Missing required fields.",
    });
  }

  // First, get the actual customer_id from the user_id
  const getCustomerIdSql = 'SELECT customer_id FROM customer WHERE user_id = ?';
  
  connection.query(getCustomerIdSql, [customer_id], (err, customerResults) => {
    if (err) {
      console.error('Error getting customer_id:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (customerResults.length === 0) {
      console.error('Customer not found for user_id:', customer_id);
      return res.status(400).json({ success: false, message: 'Customer profile not found' });
    }

        const actualCustomerId = customerResults[0].customer_id;
    console.log('Actual customer_id:', actualCustomerId);

    // Start a transaction
    connection.beginTransaction(err => {
      if (err) {
        console.error('Transaction error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      // Validate that the order exists and belongs to the customer
      const validateOrderSql = `
        SELECT oi.orderinfo_id, oi.status 
        FROM orderinfo oi 
        JOIN orderline ol ON oi.orderinfo_id = ol.orderinfo_id 
        WHERE oi.orderinfo_id = ? AND oi.customer_id = ? AND ol.item_id = ?
      `;

      connection.query(validateOrderSql, [orderinfo_id, actualCustomerId, item_id], (err, results) => {
      if (err) {
        return connection.rollback(() => {
          console.error('Order validation error:', err);
          res.status(500).json({ success: false, message: 'Database error during validation' });
        });
      }

      if (results.length === 0) {
        return connection.rollback(() => {
          console.error('Order not found or does not belong to customer');
          res.status(400).json({ success: false, message: 'Order not found or does not belong to you' });
        });
      }

      const order = results[0];
      if (order.status !== 'Delivered') {
        return connection.rollback(() => {
          console.error('Order is not delivered yet');
          res.status(400).json({ success: false, message: 'You can only review delivered orders' });
        });
      }

      // Check if review already exists (based on customer_id and item_id unique constraint)
      const checkReviewSql = `
        SELECT review_id FROM reviews 
        WHERE customer_id = ? AND item_id = ?
      `;

      connection.query(checkReviewSql, [actualCustomerId, item_id], (err, reviewResults) => {
        if (err) {
          return connection.rollback(() => {
            console.error('Review check error:', err);
            res.status(500).json({ success: false, message: 'Database error during review check' });
          });
        }

        if (reviewResults.length > 0) {
          return connection.rollback(() => {
            console.error('Review already exists for this item');
            res.status(400).json({ success: false, message: 'You have already reviewed this item' });
          });
        }

        // Insert review
        const reviewSql = `
    INSERT INTO reviews (orderinfo_id, customer_id, item_id, rating, review_text, created_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;

        connection.query(reviewSql, [orderinfo_id, actualCustomerId, item_id, rating, review_text], (err, result) => {
    if (err) {
            return connection.rollback(() => {
      console.error("Failed to insert review:", err);
              res.status(500).json({ success: false, message: "Failed to submit review." });
            });
          }

          const reviewId = result.insertId;

          // If there are images, insert them
          if (images && images.length > 0) {
            const imageValues = images.map(image => [reviewId, image.filename]);
            const imageSql = 'INSERT INTO review_images (review_id, image_path) VALUES ?';

            console.log('Inserting images:', imageValues);
            console.log('Image SQL:', imageSql);

            connection.query(imageSql, [imageValues], (err) => {
              if (err) {
                return connection.rollback(() => {
                  console.error("Failed to insert review images:", err);
                  res.status(500).json({ success: false, message: "Failed to save review images." });
                });
              }

              // Commit transaction
              connection.commit(err => {
                if (err) {
                  return connection.rollback(() => {
                    console.error('Commit error:', err);
                    res.status(500).json({ success: false, message: 'Failed to finalize review' });
                  });
                }

                res.json({ success: true, message: "Review submitted successfully!", review_id: reviewId });
              });
            });
          } else {
            // No images, just commit the review
            connection.commit(err => {
              if (err) {
                return connection.rollback(() => {
                  console.error('Commit error:', err);
                  res.status(500).json({ success: false, message: 'Failed to finalize review' });
                });
              }

              res.json({ success: true, message: "Review submitted successfully!", review_id: reviewId });
            });
          }
        });
      });
    });
  });
  });
};


  exports.getReviewsByCustomer = (req, res) => {
    const customerId = req.params.id;
  
    const sql = `
      SELECT 
        r.review_id,
        r.orderinfo_id,
        r.item_id,
        r.rating,
        r.review_text,
        r.created_at,
        i.item_name,
        i.image as item_image
      FROM reviews r
      JOIN item i ON r.item_id = i.item_id
      WHERE r.customer_id = ?
      ORDER BY r.created_at DESC
    `;
  
    connection.query(sql, [customerId], (err, results) => {
      if (err) {
        console.error("Failed to fetch reviews:", err);
        return res.status(500).json({ success: false, message: "Failed to load reviews." });
      }
  
      // If no reviews found, return empty array
      if (results.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Get review IDs to fetch images
      const reviewIds = results.map(review => review.review_id);
      const placeholders = reviewIds.map(() => '?').join(',');

      const imageSql = `
        SELECT review_id, image_path
        FROM review_images
        WHERE review_id IN (${placeholders})
        ORDER BY created_at ASC
      `;

      connection.query(imageSql, reviewIds, (err, imageResults) => {
        if (err) {
          console.error("Failed to fetch review images:", err);
          return res.status(500).json({ success: false, message: "Failed to load review images." });
        }

        // Group images by review_id
        const imagesByReview = {};
        imageResults.forEach(img => {
          if (!imagesByReview[img.review_id]) {
            imagesByReview[img.review_id] = [];
          }
          imagesByReview[img.review_id].push(img.image_path);
        });

        // Attach images to reviews
        const reviewsWithImages = results.map(review => ({
          ...review,
          images: imagesByReview[review.review_id] || []
        }));

        res.json({ success: true, data: reviewsWithImages });
      });
    });
  };
  

exports.checkReviewExists = (req, res) => {
  const { customer_id, item_id } = req.query;

  console.log('Check review exists request:', { customer_id, item_id });

  // First, get the actual customer_id from the user_id
  const getCustomerIdSql = 'SELECT customer_id FROM customer WHERE user_id = ?';
  
  connection.query(getCustomerIdSql, [customer_id], (err, customerResults) => {
    if (err) {
      console.error('Error getting customer_id:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (customerResults.length === 0) {
      console.error('Customer not found for user_id:', customer_id);
      return res.status(400).json({ success: false, message: 'Customer profile not found' });
    }

    const actualCustomerId = customerResults[0].customer_id;
    console.log('Actual customer_id:', actualCustomerId);

  const sql = `
      SELECT review_id FROM reviews 
      WHERE customer_id = ? AND item_id = ? 
    LIMIT 1
  `;

    connection.query(sql, [actualCustomerId, item_id], (err, results) => {
    if (err) {
      console.error('Check review exists error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

      console.log('Review check results:', results);

      res.json({ 
        success: true, 
        reviewed: results.length > 0,
        review_id: results.length > 0 ? results[0].review_id : null
      });
    });
  });
};

exports.updateReview = (req, res) => {
  const { review_id } = req.params;
  const { rating, review_text } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // First, verify the review belongs to the authenticated user
  const verifySql = `
    SELECT r.review_id, r.customer_id 
    FROM reviews r
    JOIN customer c ON r.customer_id = c.customer_id
    WHERE r.review_id = ? AND c.user_id = ?
  `;

  connection.query(verifySql, [review_id, userId], (err, results) => {
    if (err) {
      console.error('Error verifying review ownership:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(403).json({ success: false, message: 'You can only edit your own reviews' });
    }

    // Update the review
    const updateSql = `
      UPDATE reviews 
      SET rating = ?, review_text = ?, updated_at = NOW()
      WHERE review_id = ?
    `;

    connection.query(updateSql, [rating, review_text, review_id], (err, result) => {
      if (err) {
        console.error('Error updating review:', err);
        return res.status(500).json({ success: false, message: 'Failed to update review' });
      }
      
      res.json({ success: true, message: 'Review updated successfully' });
    });
  });
};

exports.getReviewById = (req, res) => {
  const { review_id } = req.params;

  const sql = `
    SELECT 
      r.*,
      i.item_name,
      i.image as item_image,
      CONCAT(c.fname, ' ', c.lname) as customer_name,
      u.email as customer_email,
      c.user_id
    FROM reviews r
    LEFT JOIN item i ON r.item_id = i.item_id
    LEFT JOIN customer c ON r.customer_id = c.customer_id
    LEFT JOIN users u ON c.user_id = u.id
    WHERE r.review_id = ?
  `;

  connection.query(sql, [review_id], (err, results) => {
    if (err) {
      console.error('Failed to fetch review:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch review' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = results[0];

    // Get review images
    const imageSql = `
      SELECT image_path
      FROM review_images
      WHERE review_id = ?
      ORDER BY created_at ASC
    `;

    connection.query(imageSql, [review_id], (err, imageResults) => {
      if (err) {
        console.error('Failed to fetch review images:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch review images' });
      }

      const images = imageResults.map(img => img.image_path);
      const reviewWithImages = {
        ...review,
        images: images
      };

      res.json({ success: true, data: reviewWithImages });
    });
  });
};


// Test endpoint to check database connection and table structure
exports.testConnection = (req, res) => {
  console.log('Testing database connection...');
  
  // Test basic connection
  connection.query('SELECT 1 as test', (err, results) => {
    if (err) {
      console.error('Database connection test failed:', err);
      return res.status(500).json({ success: false, message: 'Database connection failed', error: err.message });
    }
    
    console.log('Basic connection test passed');
    
    // Test reviews table
    connection.query('DESCRIBE reviews', (err, results) => {
      if (err) {
        console.error('Reviews table test failed:', err);
        return res.status(500).json({ success: false, message: 'Reviews table not found', error: err.message });
      }
      
      console.log('Reviews table structure:', results);
      
      // Test review_images table
      connection.query('DESCRIBE review_images', (err, imageResults) => {
        if (err) {
          console.error('Review_images table test failed:', err);
          return res.status(500).json({ success: false, message: 'Review_images table not found', error: err.message });
        }
        
        console.log('Review_images table structure:', imageResults);
        
        res.json({ 
          success: true, 
          message: 'Database connection and tables are working',
          reviewsTable: results,
          reviewImagesTable: imageResults
        });
      });
    });
  });
};

exports.deleteReview = (req, res) => {
  const { review_id } = req.params;

  const sql = `DELETE FROM reviews WHERE review_id = ?`;

  connection.query(sql, [review_id], (err, result) => {
    if (err) {
      console.error("Failed to delete review:", err);
      return res.status(500).json({ success: false, message: "Failed to delete review" });
    }

    res.json({ success: true, message: "Review deleted successfully" });
  });
};


exports.getReviewsByItem = (req, res) => {
  const { item_id } = req.params;

  const sql = `
    SELECT 
      r.review_id,
      r.rating, 
      r.review_text, 
      r.created_at,
      c.fname, 
      c.lname
    FROM reviews r
    JOIN customer c ON r.customer_id = c.customer_id
    WHERE r.item_id = ?
    ORDER BY r.created_at DESC
  `;

  connection.query(sql, [item_id], (err, results) => {
    if (err) {
      console.error("Failed to fetch reviews for item:", err);
      return res.status(500).json({ success: false, message: "Failed to load item reviews." });
    }

    // If no reviews found, return empty array
    if (results.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get review IDs to fetch images
    const reviewIds = results.map(review => review.review_id);
    const placeholders = reviewIds.map(() => '?').join(',');

    const imageSql = `
      SELECT review_id, image_path
      FROM review_images
      WHERE review_id IN (${placeholders})
      ORDER BY created_at ASC
    `;

    connection.query(imageSql, reviewIds, (err, imageResults) => {
      if (err) {
        console.error("Failed to fetch review images:", err);
        return res.status(500).json({ success: false, message: "Failed to load review images." });
      }

      // Group images by review_id
      const imagesByReview = {};
      imageResults.forEach(img => {
        if (!imagesByReview[img.review_id]) {
          imagesByReview[img.review_id] = [];
        }
        imagesByReview[img.review_id].push(img.image_path);
      });

      // Attach images to reviews
      const reviewsWithImages = results.map(review => ({
        ...review,
        images: imagesByReview[review.review_id] || []
      }));

      res.json({ success: true, data: reviewsWithImages });
    });
  });
};

// Admin function to get all reviews
exports.getAllReviewsForAdmin = (req, res) => {
  const { search, page = 1, limit = 25 } = req.query;
  const offset = (page - 1) * limit;
  
  let sql = `
    SELECT 
      r.review_id,
      r.orderinfo_id,
      r.rating,
      r.review_text,
      r.created_at,
      COALESCE(r.deleted_at, NULL) as deleted_at,
      i.item_name,
      i.image as item_image,
      CONCAT(c.fname, ' ', c.lname) as customer_name,
      u.email as customer_email
    FROM reviews r
    LEFT JOIN item i ON r.item_id = i.item_id
    LEFT JOIN customer c ON r.customer_id = c.customer_id
    LEFT JOIN users u ON c.user_id = u.id
  `;
  
  let countSql = `
    SELECT COUNT(*) as total
    FROM reviews r
    LEFT JOIN item i ON r.item_id = i.item_id
    LEFT JOIN customer c ON r.customer_id = c.customer_id
    LEFT JOIN users u ON c.user_id = u.id
  `;
  
  let whereConditions = [];
  let searchParams = [];
  
  // Add search functionality
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    whereConditions.push(`(
      r.review_text LIKE ? OR 
      i.item_name LIKE ? OR 
      CONCAT(c.fname, ' ', c.lname) LIKE ? OR 
      u.email LIKE ? OR 
      r.orderinfo_id LIKE ?
    )`);
    searchParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  if (whereConditions.length > 0) {
    sql += ` WHERE ${whereConditions.join(' AND ')}`;
    countSql += ` WHERE ${whereConditions.join(' AND ')}`;
  }
  
  sql += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  const queryParams = [...searchParams, parseInt(limit), offset];

  // First get total count
  connection.query(countSql, searchParams, (err, countResults) => {
    if (err) {
      console.error("Failed to count reviews:", err);
      return res.status(500).json({ success: false, message: "Failed to count reviews." });
    }

    const totalCount = countResults[0].total;

    // Then get paginated results
    connection.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error("Failed to fetch reviews for admin:", err);
      return res.status(500).json({ success: false, message: "Failed to load reviews." });
    }

    // If no reviews found, return empty array with pagination info
    if (results.length === 0) {
      return res.json({ 
        success: true, 
        data: [],
        pagination: {
          currentPage: parseInt(page),
          totalPages: 0,
          totalCount: 0,
          hasMore: false
        }
      });
    }

    // Get review IDs to fetch images
    const reviewIds = results.map(review => review.review_id);
    const placeholders = reviewIds.map(() => '?').join(',');

    const imageSql = `
      SELECT review_id, image_path
      FROM review_images
      WHERE review_id IN (${placeholders})
      ORDER BY created_at ASC
    `;

    connection.query(imageSql, reviewIds, (err, imageResults) => {
      if (err) {
        console.error("Failed to fetch review images:", err);
        return res.status(500).json({ success: false, message: "Failed to load review images." });
      }

      // Group images by review_id
      const imagesByReview = {};
      imageResults.forEach(img => {
        if (!imagesByReview[img.review_id]) {
          imagesByReview[img.review_id] = [];
        }
        imagesByReview[img.review_id].push(img.image_path);
      });

      // Attach images to reviews and format for DataTable
      const reviewsWithImages = results.map(review => ({
        review_id: review.review_id,
        orderinfo_id: review.orderinfo_id,
        customer_name: review.customer_name || 'N/A',
        customer_email: review.customer_email || 'N/A',
        item_name: review.item_name || 'N/A',
        item_image: review.item_image,
        rating: review.rating,
        review_text: review.review_text,
        review_images: imagesByReview[review.review_id] || [],
        created_at: review.created_at,
        deleted_at: review.deleted_at
      }));

      res.json({ 
        success: true, 
        data: reviewsWithImages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount: totalCount,
          hasMore: (parseInt(page) * limit) < totalCount
        }
      });
    });
  });
  });
};

// Admin function to get single review details
exports.getReviewForAdmin = (req, res) => {
  const { review_id } = req.params;

  const sql = `
    SELECT 
      r.review_id,
      r.orderinfo_id,
      r.rating,
      r.review_text,
      r.created_at,
      COALESCE(r.deleted_at, NULL) as deleted_at,
      i.item_name,
      i.image as item_image,
      CONCAT(c.fname, ' ', c.lname) as customer_name,
      u.email as customer_email
    FROM reviews r
    LEFT JOIN item i ON r.item_id = i.item_id
    LEFT JOIN customer c ON r.customer_id = c.customer_id
    LEFT JOIN users u ON c.user_id = u.id
    WHERE r.review_id = ?
  `;

  connection.query(sql, [review_id], (err, results) => {
    if (err) {
      console.error('Failed to fetch review for admin:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch review' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const review = results[0];

    // Get review images
    const imageSql = `
      SELECT image_path
      FROM review_images
      WHERE review_id = ?
      ORDER BY created_at ASC
    `;

    connection.query(imageSql, [review_id], (err, imageResults) => {
      if (err) {
        console.error('Failed to fetch review images:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch review images' });
      }

      const images = imageResults.map(img => img.image_path);
      const reviewWithImages = {
        ...review,
        review_images: images
      };

      res.json({ success: true, result: [reviewWithImages] });
    });
  });
};

// Admin function to soft delete review
exports.softDeleteReview = (req, res) => {
  const { review_id } = req.params;

  // First check if deleted_at column exists
  connection.query("SHOW COLUMNS FROM reviews LIKE 'deleted_at'", (err, columns) => {
    if (err) {
      console.error("Failed to check deleted_at column:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (columns.length === 0) {
      // Column doesn't exist, use hard delete
      const deleteSql = `DELETE FROM reviews WHERE review_id = ?`;
      connection.query(deleteSql, [review_id], (err, result) => {
        if (err) {
          console.error("Failed to delete review:", err);
          return res.status(500).json({ success: false, message: "Failed to delete review" });
        }
        res.json({ success: true, message: "Review deleted successfully" });
      });
    } else {
      // Column exists, use soft delete
      const sql = `UPDATE reviews SET deleted_at = NOW() WHERE review_id = ?`;
      connection.query(sql, [review_id], (err, result) => {
        if (err) {
          console.error("Failed to soft delete review:", err);
          return res.status(500).json({ success: false, message: "Failed to delete review" });
        }
        res.json({ success: true, message: "Review deleted successfully" });
      });
    }
  });
};

// Admin function to restore review
exports.restoreReview = (req, res) => {
  const { review_id } = req.params;

  // First check if deleted_at column exists
  connection.query("SHOW COLUMNS FROM reviews LIKE 'deleted_at'", (err, columns) => {
    if (err) {
      console.error("Failed to check deleted_at column:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (columns.length === 0) {
      // Column doesn't exist, can't restore
      return res.status(400).json({ success: false, message: "Restore functionality not available" });
    } else {
      // Column exists, restore
      const sql = `UPDATE reviews SET deleted_at = NULL WHERE review_id = ?`;
      connection.query(sql, [review_id], (err, result) => {
        if (err) {
          console.error("Failed to restore review:", err);
          return res.status(500).json({ success: false, message: "Failed to restore review" });
        }
        res.json({ success: true, message: "Review restored successfully" });
      });
    }
  });
};