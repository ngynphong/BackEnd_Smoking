const express = require("express");
const progressRouter = express.Router();
const progressController = require("../controllers/progress.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

progressRouter.post(
  "/",
  validateToken,
  checkRole(["coach", "admin", "user"]),
  progressController.createProgress
);

progressRouter.get(
  "/stage/:stageId",
  validateToken,
  checkRole(["coach", "admin", "user"]),
  progressController.getProgressByStage
);

progressRouter.get(
  "/:id",
  validateToken,
  checkRole(["coach", "admin", "user"]),
  progressController.getProgressById
);

progressRouter.put(
  "/:id",
  validateToken,
  checkRole(["coach", "admin", "user"]),
  progressController.updateProgress
);

progressRouter.delete(
  "/:id",
  validateToken,
  checkRole(["coach", "admin", "user"]),
  progressController.deleteProgress
);
// 🔐 Get all progress — Admin, Coach, User (lọc theo quyền trong controller)
progressRouter.get(
  "/",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  progressController.getAllProgress
);

progressRouter.get(
  "/user/:id",
  validateToken,
  progressController.getUserOverallProgress
);

progressRouter.get(
  "/plan/:id",
  validateToken,
  progressController.getSinglePlanProgress
);

progressRouter.get(
  "/stage/:id/user",
  validateToken,
  progressController.getSingleStageProgress
);

progressRouter.get(
  "/plan/:planId/smoking-stats",
  validateToken,
  progressController.getPlanSmokingStats
);

progressRouter.get(
  "/consecutive-no-smoke/:id",
  validateToken,
  progressController.getConsecutiveNoSmokeDays
);

progressRouter.get(
  "/plan/:id/money-saved",
  validateToken,
  progressController.getTotalMoneySavedInPlan
);
module.exports = progressRouter;
