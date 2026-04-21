// ============================================================
// FighTea — Analytics Controller
// File: /backend/controllers/analyticsController.js
// ============================================================
'use strict';

const db = require('../config/db');

async function getSummary(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [[{ total_revenue }]] = await db.query(
      "SELECT COALESCE(SUM(total),0) AS total_revenue FROM orders WHERE payment_status='paid'"
    );
    const [[{ today_revenue }]] = await db.query(
      "SELECT COALESCE(SUM(total),0) AS today_revenue FROM orders WHERE payment_status='paid' AND order_date=?", [today]
    );
    const [[{ total_orders }]]    = await db.query('SELECT COUNT(*) AS total_orders FROM orders');
    const [[{ today_orders }]]    = await db.query('SELECT COUNT(*) AS today_orders FROM orders WHERE order_date=?', [today]);
    const [[{ completed }]]       = await db.query("SELECT COUNT(*) AS completed FROM orders WHERE status='completed'");
    const [[{ gcash_count }]]     = await db.query("SELECT COUNT(*) AS gcash_count FROM orders WHERE payment_method='gcash'");
    const [[{ cash_count }]]      = await db.query("SELECT COUNT(*) AS cash_count FROM orders WHERE payment_method='cash'");
    const [[{ pending_revenue }]] = await db.query(
      "SELECT COALESCE(SUM(total),0) AS pending_revenue FROM orders WHERE payment_method='cash' AND payment_status='unpaid'"
    );
    const [topItems] = await db.query(
      `SELECT p.name, p.emoji, p.image_url AS image,
              SUM(oi.quantity) AS count, SUM(oi.line_total) AS revenue
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status != 'cancelled'
       GROUP BY p.id ORDER BY count DESC LIMIT 5`
    );
    const [byStatus] = await db.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');

    res.json({
      total_revenue, today_revenue, pending_revenue,
      total_orders, today_orders, completed,
      gcash_count, cash_count,
      avg_order: total_orders > 0 ? (total_revenue / total_orders) : 0,
      top_items: topItems,
      by_status: Object.fromEntries(byStatus.map(r => [r.status, r.n])),
    });
  } catch (err) {
    console.error('analytics error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getSummary };
