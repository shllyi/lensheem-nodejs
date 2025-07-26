const db = require('../config/database');

exports.getDashboardStats = (req, res) => {
    const stats = {};

    db.query('SELECT COUNT(*) AS total_users FROM users', (err, userResult) => {
        if (err) return res.status(500).json({ error: err });

        stats.total_users = userResult[0].total_users;

        db.query('SELECT COUNT(*) AS total_items FROM item', (err, itemResult) => {
            if (err) return res.status(500).json({ error: err });

            stats.total_items = itemResult[0].total_items;

            db.query('SELECT COUNT(*) AS total_orders FROM orders', (err, orderResult) => {
                if (err) return res.status(500).json({ error: err });

                stats.total_orders = orderResult[0].total_orders;

                res.json({ status: 'success', data: stats });
            });
        });
    });
};