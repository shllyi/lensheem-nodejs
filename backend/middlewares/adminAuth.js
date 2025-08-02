const jwt = require("jsonwebtoken");
const db = require("../config/database");

// Enhanced middleware to check if user is authenticated and has admin role
exports.requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Log the request for debugging
  console.log(`Admin Auth Check - Path: ${req.path}, Method: ${req.method}`);
  console.log(`Auth Header: ${authHeader ? 'Present' : 'Missing'}`);

  if (!token) {
    console.log('Access denied: No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Access denied. No token provided.',
      error: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    console.log('Token decoded successfully:', { id: decoded.id, role: decoded.role });
    
    // Check if user has admin role (case-insensitive)
    if (!decoded.role || decoded.role.toLowerCase() !== 'admin') {
      console.log('Access denied: User role is not admin. Role:', decoded.role);
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin privileges required.',
        error: 'INSUFFICIENT_PRIVILEGES',
        userRole: decoded.role
      });
    }

    // Additional security: Verify admin status in database
    db.query(
      'SELECT id, role, status FROM users WHERE id = ? AND deleted_at IS NULL',
      [decoded.id],
      (err, results) => {
        if (err) {
          console.error('Database error during admin verification:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error during admin verification',
            error: 'DB_ERROR'
          });
        }

        if (results.length === 0) {
          console.log('Access denied: User not found in database');
          return res.status(403).json({ 
            success: false,
            message: 'User account not found or has been deleted',
            error: 'USER_NOT_FOUND'
          });
        }

        const user = results[0];
        
        // Only block if status is explicitly 'deactivated'
        if (user.status && user.status.toLowerCase() === 'deactivated') {
          console.log('Access denied: User account is deactivated. Status:', user.status);
          return res.status(403).json({ 
            success: false,
            message: 'User account is deactivated',
            error: 'ACCOUNT_DEACTIVATED',
            status: user.status
          });
        }

        if (user.role.toLowerCase() !== 'admin') {
          console.log('Access denied: Database role verification failed. Role:', user.role);
          return res.status(403).json({ 
            success: false,
            message: 'Admin privileges required',
            error: 'INSUFFICIENT_PRIVILEGES_DB',
            userRole: user.role
          });
        }

        // Set user info in request object
        req.user = {
          id: user.id,
          role: user.role,
          status: user.status
        };

        console.log('Admin authentication successful for user:', user.id);
        next();
      }
    );

  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please login again.',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token.',
        error: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Token verification failed.',
      error: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

// Middleware to check if user is authenticated (any role)
exports.requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`Auth Check - Path: ${req.path}, Method: ${req.method}`);

  if (!token) {
    console.log('Access denied: No token provided');
    return res.status(401).json({ 
      success: false,
      message: 'Access denied. No token provided.',
      error: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    console.log('Token decoded successfully:', { id: decoded.id, role: decoded.role });
    
    // Verify user exists and is active
    db.query(
      'SELECT id, role, status FROM users WHERE id = ? AND deleted_at IS NULL',
      [decoded.id],
      (err, results) => {
        if (err) {
          console.error('Database error during auth verification:', err);
          return res.status(500).json({ 
            success: false,
            message: 'Database error during authentication',
            error: 'DB_ERROR'
          });
        }

        if (results.length === 0) {
          console.log('Access denied: User not found in database');
          return res.status(403).json({ 
            success: false,
            message: 'User account not found or has been deleted',
            error: 'USER_NOT_FOUND'
          });
        }

        const user = results[0];
        
        // Only block if status is explicitly 'deactivated'
        if (user.status && user.status.toLowerCase() === 'deactivated') {
          console.log('Access denied: User account is deactivated. Status:', user.status);
          return res.status(403).json({ 
            success: false,
            message: 'User account is deactivated',
            error: 'ACCOUNT_DEACTIVATED',
            status: user.status
          });
        }

        req.user = {
          id: user.id,
          role: user.role,
          status: user.status
        };

        console.log('Authentication successful for user:', user.id);
        next();
      }
    );

  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired. Please login again.',
        error: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token.',
        error: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: 'Token verification failed.',
      error: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

// Middleware to check specific roles
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.log('Access denied: No user or role information');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Role not determined.',
        error: 'ROLE_NOT_DETERMINED'
      });
    }

    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());

    console.log(`Role check - User role: ${userRole}, Allowed roles: ${allowedRoles}`);

    if (!allowedRoles.includes(userRole)) {
      console.log('Access denied: Insufficient role privileges');
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`,
        error: 'INSUFFICIENT_ROLE_PRIVILEGES',
        userRole: userRole,
        requiredRoles: allowedRoles
      });
    }

    console.log('Role verification successful');
    next();
  };
};

// Enhanced middleware to verify admin status in database (additional security)
exports.verifyAdminInDB = (req, res, next) => {
  const userId = req.user.id;
  
  console.log('Verifying admin status in database for user:', userId);
  
  db.query(
    'SELECT id, role, status FROM users WHERE id = ? AND deleted_at IS NULL',
    [userId],
    (err, results) => {
      if (err) {
        console.error('Database error during admin verification:', err);
        return res.status(500).json({ 
          success: false,
          message: 'Database error during admin verification',
          error: 'DB_ERROR'
        });
      }

      if (results.length === 0) {
        console.log('Access denied: User not found in database');
        return res.status(403).json({ 
          success: false,
          message: 'User account not found',
          error: 'USER_NOT_FOUND'
        });
      }

      const user = results[0];
      const userRole = user.role.toLowerCase();
      
      console.log('Database role verification - User role:', userRole);
      
      if (userRole !== 'admin') {
        console.log('Access denied: Database role verification failed');
        return res.status(403).json({ 
          success: false,
          message: 'Admin privileges required',
          error: 'INSUFFICIENT_PRIVILEGES_DB',
          userRole: userRole
        });
      }

      // Only block if status is explicitly 'deactivated'
      if (user.status && user.status.toLowerCase() === 'deactivated') {
        console.log('Access denied: User account is deactivated');
        return res.status(403).json({ 
          success: false,
          message: 'User account is deactivated',
          error: 'ACCOUNT_DEACTIVATED',
          status: user.status
        });
      }

      console.log('Database admin verification successful');
      next();
    }
  );
}; 