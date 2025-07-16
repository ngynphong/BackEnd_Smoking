const express = require('express');
const cravingLogRouter = express.Router();
const cravingLogController = require('../controllers/cravingLog.controller');
const { validateToken } = require('../middlewares/AuthMiddleware');

// POST /api/craving-log/
cravingLogRouter.post('/', validateToken, cravingLogController.createCravingLog);

module.exports = cravingLogRouter;