const connection = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ----------------- Register -----------------
const registerUser = async (req, res) => {
  const { name, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const userSql = 'INSERT INTO users (name, password, email) VALUES (?, ?, ?)';

  try {
    connection.execute(userSql, [name, hashedPassword, email], (err, result) => {
      if (err instanceof Error) {
        console.log(err);
        return res.status(401).json({ error: err });
      }

      return res.status(200).json({ success: true, result });
    });
  } catch (error) {
    console.log(error);
  }
};
//create admin
 const createAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  // Validate input
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email and password are required',
      code: 'MISSING_FIELDS'
    });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email format',
      code: 'INVALID_EMAIL'
    });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters',
      code: 'WEAK_PASSWORD'
    });
  }

  try {
    // Use promise-based queries for better error handling
    const [checkResults] = await connection.promise().execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (checkResults.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await connection.promise().execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin'] // Using lowercase 'admin' for consistency
    );

    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        userId: result.insertId,
        email,
        role: 'admin'
      }
    });

  } catch (error) {
    console.error('Admin creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
  // ----------------- Login -----------------
const loginUser = (req, res) => {
  const { email, password } = req.body;

  const checkSql = 'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL';

  connection.execute(checkSql, [email], async (err, users) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Error checking user', details: err });
    }

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = users[0];

    // ❌ Block deactivated users
    const status = (user.status || '').trim().toLowerCase();
    if (status === 'deactivated') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // ✅ Password compare
    const safePasswordHash = user.password.replace(/^\$2y\$/, '$2b$');
    const match = await bcrypt.compare(password, safePasswordHash);

    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 🔐 Issue token with role included
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback-secret-key');
    
    // Try to update token in database, but don't fail if column doesn't exist
    const updateSql = 'UPDATE users SET token = ? WHERE id = ?';

    connection.execute(updateSql, [token, user.id], (updateErr) => {
      if (updateErr) {
        console.error('Token update error:', updateErr);
        // Don't fail the login if token column doesn't exist
        // Just log the error and continue with login
      }

      delete user.password;
      res.status(200).json({ 
        success: 'welcome back', 
        user, 
        token,
        role: user.role // Explicitly include role in response
      });
    });
  });
};


// ----------------- Create or Update Profile -----------------
const updateUser = (req, res) => {
  const { title, fname, lname, addressline, town, phone, userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const image = req.file ? req.file.path.replace(/\\/g, "/").replace("public/", "") : null;

  const checkSql = `SELECT customer_id FROM customer WHERE user_id = ?`;
  connection.execute(checkSql, [userId], (checkErr, checkResult) => {
    if (checkErr) {
      console.log("Check customer error:", checkErr);
      return res.status(500).json({ error: checkErr });
    }

    if (checkResult.length > 0) {
      // ✅ Update profile
      let updateSql, updateParams;

      if (image) {
        updateSql = `
          UPDATE customer SET 
            title = ?, 
            fname = ?, 
            lname = ?, 
            addressline = ?, 
            town = ?, 
            phone = ?, 
            image_path = ?
          WHERE user_id = ?`;
        updateParams = [title, fname, lname, addressline, town, phone, image, userId];
      } else {
        updateSql = `
          UPDATE customer SET 
            title = ?, 
            fname = ?, 
            lname = ?, 
            addressline = ?, 
            town = ?, 
            phone = ?
          WHERE user_id = ?`;
        updateParams = [title, fname, lname, addressline, town, phone, userId];
      }

      connection.execute(updateSql, updateParams, (updateErr, updateResult) => {
        if (updateErr instanceof Error) {
          console.log("Update error:", updateErr);
          return res.status(500).json({ error: updateErr });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully.',
          result: updateResult
        });
      });
    } else {
      // 🆕 Insert profile
      const insertSql = `
        INSERT INTO customer 
          (title, fname, lname, addressline, town, phone, image_path, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const insertParams = [title, fname, lname, addressline, town, phone, image, userId];

      connection.execute(insertSql, insertParams, (insertErr, insertResult) => {
        if (insertErr instanceof Error) {
          console.log("Insert error:", insertErr);
          return res.status(500).json({ error: insertErr });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile created successfully.',
          result: insertResult
        });
      });
    }
  });
};

// ----------------- Deactivate User -----------------
const deactivateUser = async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({
      success: false,
      error: 'User ID and password are required',
      code: 'MISSING_FIELDS'
    });
  }

  try {
    // Start transaction
    await connection.promise().beginTransaction();

    try {
      // 1. Get user data including password hash
      const [userRows] = await connection.promise().execute(
        `SELECT id, password, email, status 
         FROM users 
         WHERE id = ?`,
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const user = userRows[0];

      // Verify password (with hash conversion if needed)
      const passwordHash = user.password.replace(/^\$2y\$/, '$2b$');
      const passwordMatch = await bcrypt.compare(password, passwordHash);

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Deactivate user account 
      const [result] = await connection.promise().execute(
        `UPDATE users 
         SET status = 'Deactivated', 
             token = NULL, 
             updated_at = NOW() 
         WHERE id = ?`,
        [userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('No rows affected - user not updated');
      }

      // Commit transaction
      await connection.promise().commit();

      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        userId,
        updated_at: new Date().toISOString()
      });

    } catch (transactionErr) {
      // Rollback on error
      await connection.promise().rollback();
      console.error('Transaction error:', transactionErr);
      throw transactionErr;
    }

  } catch (err) {
    console.error('Deactivation error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error during deactivation',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      code: 'SERVER_ERROR'
    });
  }
};

// ----------------- Get Customer Profile -----------------
const getCustomerProfile = (req, res) => {
  const userId = req.params.userId;
  const sql = 'SELECT * FROM customer WHERE user_id = ?';

  connection.execute(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: 'No profile found' });

    return res.status(200).json({ success: true, data: results[0] });
  });
};

const updateUserRole = (req, res) => {
  const id = req.params.id;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const sql = `
        UPDATE users
        SET role = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
    `;
  const values = [role, id];

  try {
    connection.execute(sql, values, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: 'Error updating user role', details: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'User role updated successfully'
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateUserStatus = (req, res) => {
  const id = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const sql = `
        UPDATE users
        SET status = ?, updated_at = NOW()
        WHERE id = ? AND deleted_at IS NULL
    `;
  const values = [status, id];

  try {
    connection.execute(sql, values, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: 'Error updating user status', details: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'User status updated successfully'
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getAllUsers = (req, res) => {
  const sql = `
        SELECT 
          u.id as user_id,
          c.customer_id,
          u.title,
          u.name as fname,
          u.lname,
          u.email,
          u.role,
          u.status,
          u.image_path,
          c.addressline,
          c.town,
          c.phone
        FROM users u
        LEFT JOIN customer c ON u.id = c.user_id
        WHERE u.deleted_at IS NULL
        ORDER BY u.id DESC
    `;

  connection.execute(sql, (err, users) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        error: 'Database error fetching users',
        details: err.message
      });
    }

    return res.status(200).json({
      success: true,
      rows: users
    });
  });
};

const getSingleUser = (req, res) => {
  const id = req.params.id;

  // Validate ID
  if (!id || isNaN(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid user ID'
    });
  }

  const sql = `
        SELECT u.*, c.addressline, c.town, c.phone
        FROM users u
        LEFT JOIN customer c ON u.id = c.user_id
        WHERE u.id = ? AND u.deleted_at IS NULL
    `;

  const values = [parseInt(id)];

  connection.execute(sql, values, (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        error: 'Database error fetching user',
        details: err.message
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('User fetched successfully:', result[0]);
    return res.status(200).json({
      success: true,
      result: result[0]
    });
  });
};
// const deleteUser = (req, res) => {
//     const id = req.params.id;

//     const sql = `
//         UPDATE users
//         SET deleted_at = NOW()
//         WHERE id = ? AND deleted_at IS NULL
//     `;
//     const values = [id];

//     try {
//         connection.execute(sql, values, (err, result) => {
//             if (err) {
//                 console.log(err);
//                 return res.status(500).json({ error: 'Error deleting user', details: err });
//             }

//             if (result.affectedRows === 0) {
//                 return res.status(404).json({ error: 'User not found' });
//             }

//             return res.status(200).json({
//                 success: true,
//                 message: 'User deleted successfully'
//             });
//         });
//     } catch (error) {
//         console.log(error);
//         return res.status(500).json({ error: 'Server error' });
//     }
// };


module.exports = {
  registerUser,
  loginUser,
  createAdmin,
  updateUser,
  deactivateUser,
  updateUserRole,
  updateUserStatus,
  getCustomerProfile,
  getAllUsers,
  getSingleUser
};