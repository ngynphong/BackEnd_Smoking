const express = require("express");
const stageRouter = express.Router();
const stageController = require("../controllers/stage.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔐 Create stage — Coach, Admin (phải có quyền với plan)
stageRouter.post(
  "/",
  validateToken,
  checkRole(["coach", "admin"]),
  stageController.createStage
);
stageRouter.get(
  "/my",
  validateToken,
  checkRole(["coach"]),
  stageController.getStagesByCoach
);
// 🔐 Get all stages for a quit plan — Owner, Coach, Admin
stageRouter.get(
  "/plan/:planId",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  stageController.getStagesByPlan
);

// 🔐 Get one stage by ID — Owner, Coach, Admin
stageRouter.get(
  "/:id",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  stageController.getStageById
);

// 🔐 Update a stage — Coach, Admin (chỉ khi có quyền trên plan)
stageRouter.put(
  "/:id",
  validateToken,
  checkRole(["coach", "admin"]),
  stageController.updateStage
);

// 🔐 Delete a stage — Admin only
stageRouter.delete(
  "/:id",
  validateToken,
  checkRole(["admin", "coach"]),
  stageController.deleteStage
);
// 🔐 Get all stages (Admin only)
stageRouter.get(
  "/",
  validateToken,
  checkRole(["coach", "admin"]),
  stageController.getAllStages
);

module.exports = stageRouter;
