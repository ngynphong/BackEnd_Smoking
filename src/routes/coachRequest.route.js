const express = require("express");
const coachRequestRouter = express.Router();
const controller = require("../controllers/coachRequest.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

// Gửi lời mời (admin hoặc coach)
coachRequestRouter.post(
  "/invite/:userId",
  validateToken,
  checkRole(["admin", "coach"]),
  controller.sendCoachInvite
);

// User phản hồi
coachRequestRouter.post(
  "/respond/:requestId",
  validateToken,
  checkRole(["user"]),
  controller.respondToInvite
);

// Lấy tất cả lời mời (Admin xem toàn bộ, User xem của mình)
coachRequestRouter.get(
  "/",
  validateToken,
  checkRole(["admin", "coach"]),
  controller.getAllCoachRequests
);
module.exports = coachRequestRouter;
