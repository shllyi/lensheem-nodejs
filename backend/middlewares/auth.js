const jwt = require("jsonwebtoken");
const db = require("../config/database");

exports.isAuthenticatedUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const tabContext = req.headers['x-tab-context']; // New: Get tab context

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Authorization token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: err.name === 'TokenExpiredError' 
          ? 'Session expired. Please login again'
          : 'Invalid authentication token'
      });
    }

    // New: Basic tab context validation
    if (tabContext) {
      if (decoded.role === 'admin' && tabContext !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin accounts must use the admin interface'
        });
      }
      
      if (decoded.role === 'user' && tabContext !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'User accounts must use the user interface'
        });
      }
    }

    req.user = decoded;
    next();
  });
};

// Updated isAdmin middleware with caching
exports.isAdmin = (req, res, next) => {
  // First check if role is already in req.user (from token)
  if (req.user.role && req.user.role.toLowerCase() === 'admin') {
    return next();
  }

  // Fallback to database check
  const userId = req.user.id;
  db.query(
    'SELECT role FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ 
          success: false,
          message: 'Database error',
          error: err.message 
        });
      }

      if (results.length === 0) {
        return res.status(403).json({ 
          success: false,
          message: 'User account not found' 
        });
      }

      const userRole = results[0].role.toLowerCase();
      req.user.role = userRole; // Cache the role

      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          message: 'Admin privileges required' 
        });
      }

      next();
    }
  );
};

// Updated authorizeRoles with case insensitivity
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(403).json({
          success: false,
          message: 'User role not determined'
        });
      }

      const userRole = req.user.role.toLowerCase();
      const allowedRoles = roles.map(r => r.toLowerCase());

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Role (${req.user.role}) is not authorized`
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// New middleware for tab context validation
exports.validateTabContext = (requiredContext) => {
  return (req, res, next) => {
    const tabContext = req.headers['x-tab-context'];
    
    if (!tabContext) {
      return next(); // Skip if no context provided
    }

    if (tabContext !== requiredContext) {
      return res.status(403).json({
        success: false,
        message: `This resource requires ${requiredContext} interface`
      });
    }

    next();
  };
};