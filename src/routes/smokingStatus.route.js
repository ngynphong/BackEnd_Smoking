const express = require('express');
const statusRouter = express.Router();
const smokingStatusController = require('../controllers/smokingStatus.controller');
const { validateToken, checkRole } = require('../middlewares/AuthMiddleware');

statusRouter.post('/:id', validateToken, smokingStatusController.createSmokingStatus);
statusRouter.put('/:id', validateToken, smokingStatusController.updateSmokingStatus);
statusRouter.get('/:id', validateToken, smokingStatusController.getStatusBysUserId);
statusRouter.delete('/:id', validateToken, smokingStatusController.deleteSmokingStatus);
statusRouter.get('/student/:studentId', validateToken, checkRole(['coach']), smokingStatusController.getStudentSmokingStatusByCoach);

module.exports = statusRouter;