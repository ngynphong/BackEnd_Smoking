const express = require('express');
const badgeController = require('../controllers/badge.controller');
const badgeRouter = express.Router();
const { validateToken, checkRole } = require('../middlewares/AuthMiddleware');

badgeRouter.put('/:id', validateToken, checkRole(['admin', 'coach']), badgeController.updateBadge);
badgeRouter.delete('/:id', validateToken, checkRole(['admin', 'coach']), badgeController.deleteBadge);
badgeRouter.post('/create', validateToken, checkRole(['admin', 'coach']), badgeController.createBadge);
badgeRouter.get('/', validateToken, checkRole(['admin', 'coach']), badgeController.getAllBadges);
badgeRouter.get('/user/:id', validateToken, badgeController.getAllBadgesWithUserStatus);
badgeRouter.get('/leaderboard', badgeController.getBadgeLeaderBoard);
badgeRouter.get('/user-stats', checkRole(['admin', 'coach']), badgeController.getBadgeStats);
badgeRouter.get('/progress', validateToken, badgeController.getBadgeProgress);

module.exports = badgeRouter;