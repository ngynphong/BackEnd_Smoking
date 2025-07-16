const express = require("express");
const notificationRouter = express.Router();
const notificationController = require("../controllers/notification.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

// [POST] Tạo thông báo
notificationRouter.post(
  "/",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  notificationController.createNotification
);

// [GET] Lấy tất cả thông báo
notificationRouter.get(
  "/",
  validateToken,
  checkRole(["admin", "coach", "user"]),
  notificationController.getAllNotifications
);

notificationRouter.get(
  "/my-students-progress",
  validateToken,
  checkRole(["coach"]),
  notificationController.getMyStudentsWithProgress
);

// [GET] Lấy thông báo theo ID
notificationRouter.get(
  "/:id",
  validateToken,
  checkRole(["admin", "coach", "user"]),
  notificationController.getNotificationById
);

notificationRouter.put('/mark-read', validateToken, notificationController.markAsRead);

// [PUT] Cập nhật thông báo
notificationRouter.put(
  "/:id",
  validateToken,
  checkRole(["admin", "coach"]),
  notificationController.updateNotification
);

// [DELETE] Xóa thông báo
notificationRouter.delete(
  "/:id",
  validateToken,
  checkRole(["admin"]),
  notificationController.deleteNotification
);


// [GET] Lấy tất cả thông báo của user theo tiến trình
notificationRouter.get(
  "/user/:userId",
  validateToken,
  checkRole(["user", "coach", "admin"]),
  notificationController.getNotificationsByUser
);


module.exports = notificationRouter;
