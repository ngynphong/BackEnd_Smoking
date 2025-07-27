const express = require("express");
const taskRouter = express.Router();
const taskController = require("../controllers/task.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

// 🔐 Tạo task mới — Coach, Admin (phải có quyền với stage)
taskRouter.post(
  "/",
  validateToken,
  checkRole(["coach", "admin"]),
  taskController.createTask
);
//Get all

taskRouter.get(
  "/",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  taskController.getAllTasks
);

// 🔐 Lấy tất cả task theo stage_id — Owner, Coach, Admin
taskRouter.get(
  "/stage/:stageId",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  taskController.getTasksByStage
);

// 🔐 Lấy 1 task theo ID — Owner, Coach, Admin
taskRouter.get(
  "/:id",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  taskController.getTaskById
);

// 🔐 Cập nhật task — Coach, Admin (phải có quyền với stage)
taskRouter.put(
  "/:id",
  validateToken,
  checkRole(["coach", "admin"]),
  taskController.updateTask
);

// 🔐 Xóa task — Admin only
taskRouter.delete(
  "/:id",
  validateToken,
  checkRole(["coach", "admin"]),
  taskController.deleteTask
);

taskRouter.post("/:id/complete", validateToken, taskController.completeTask);

taskRouter.get(
  "/stage/:id/completed",
  validateToken,
  taskController.getCompletedTasksByStage
);

module.exports = taskRouter;
