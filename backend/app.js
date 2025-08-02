const express = require('express');
const cors = require('cors');
const path = require('path');
const users = require('./routes/user');
const itemRoutes = require('./routes/item');
const dashboardRoutes = require('./routes/dashboard');
const categoryRoutes = require('./routes/category');
const orderRoutes = require('./routes/order');
const reviewRoutes = require('./routes/reviews');
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images from public/uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/users', users);
app.use('/api/item', itemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/orders', orderRoutes);  
app.use('/api/reviews', reviewRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);

// Static files and SPA routing
const frontendPath = path.join(__dirname, '../frontend');

// Serve static files only for non-API routes
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    express.static(frontendPath)(req, res, next);
});

app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // If the request has a file extension, skip to next (which will 404 if not found)
    if (req.path.includes('.') && path.extname(req.path)) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

module.exports = app;