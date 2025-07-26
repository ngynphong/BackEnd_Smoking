const express = require("express");
const financialGoalRouter = express.Router();
const controller = require("../controllers/financialGoal.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

// User tạo mục tiêu tiết kiệm
financialGoalRouter.post(
  "/",
  validateToken,
  checkRole(["user"]),
  controller.createGoal
);

//  User xem mục tiêu của chính mình
financialGoalRouter.get(
  "/me",
  validateToken,
  checkRole(["user"]),
  controller.getMyGoals
);

//  Coach xem mục tiêu của học viên mình quản lý, hoặc admin xem bất kỳ user nào
financialGoalRouter.get(
  "/user/:id",
  validateToken,
  checkRole(["coach", "admin"]),
  controller.getGoalsByUser
);

//  Lấy tiến độ tiết kiệm theo goal ID (cho owner, coach hoặc admin)
financialGoalRouter.get(
  "/progress/:id", // goalId
  validateToken,
  checkRole(["user", "coach", "admin"]),
  controller.getGoalProgress
);

//  Cập nhật mục tiêu (sửa tên, tiền, trạng thái)
financialGoalRouter.put(
  "/:id",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  controller.updateGoal
);

//  Xoá mục tiêu
financialGoalRouter.delete(
  "/:id",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  controller.deleteGoal
);

module.exports = financialGoalRouter;
