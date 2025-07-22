const express = require('express');
const dashboardRouter = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { validateToken, checkRole } = require('../middlewares/AuthMiddleware');

// API để lấy tất cả dữ liệu thống kê cho trang dashboard của admin
// Chỉ có admin mới có quyền truy cập
dashboardRouter.get(
    '/statistics',
    validateToken,
    checkRole(['admin']),
    dashboardController.getDashboardStatistics
);

module.exports = dashboardRouter;