const express = require('express');
const relapseEventRouter = express.Router();
const relapseEventController = require('../controllers/relapseEvent.controller');
const { validateToken } = require('../middlewares/AuthMiddleware');

// Endpoint để client gửi dữ liệu sự kiện tái nghiện
// POST /api/relapse-events
relapseEventRouter.post('/', validateToken, relapseEventController.createRelapseEvent);

module.exports = relapseEventRouter;