const express = require("express");
const quitPlanRouter = express.Router();
const quitPlanController = require("../controllers/quitPlan.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");
const {
  checkSubscriptionAccess,
} = require("../middlewares/SubscriptionMiddleware");

//Get all quit plan public
quitPlanRouter.get("/public", validateToken, quitPlanController.getPublicPlans);
quitPlanRouter.get(
  "/my-users",
  validateToken,
  checkRole(["coach"]),
  quitPlanController.getUsersByCoach
);
//get all quit plan requests
quitPlanRouter.get(
  "/requests",
  validateToken,
  quitPlanController.getAllQuitPlanRequests
);
// 🔐 Get all quit plans — Admin only
quitPlanRouter.get(
  "/",
  validateToken,
  checkRole(["admin", "coach"]),
  quitPlanController.getAllQuitPlans
);

// 🔐 Get a quit plan by ID — Only owner or admin
quitPlanRouter.get("/:id", validateToken, quitPlanController.getQuitPlanById);

quitPlanRouter.get(
  "/user/:id",
  validateToken,
  quitPlanController.getQuitPlanByUserId
);
// 🔐 Create a new quit plan — User or Coach (Coach can create on behalf of user)
quitPlanRouter.post(
  "/",
  validateToken,
  checkRole(["coach", "admin"]),

  quitPlanController.createQuitPlan
);

// 🔐 Update a quit plan — Only owner or admin
quitPlanRouter.put(
  "/:id",
  validateToken,
  checkRole(["coach", "admin"]),
  quitPlanController.updateQuitPlan
);

// 🔐 Delete a quit plan — Admin only
quitPlanRouter.delete(
  "/:id",
  validateToken,
  checkRole(["admin"]),
  quitPlanController.deleteQuitPlan
);

// 🆕 Admin/Coach duyệt kế hoạch
quitPlanRouter.put(
  "/:id/approve",
  validateToken,
  checkRole(["admin", "coach"]),
  quitPlanController.approveQuitPlan
);
quitPlanRouter.put(
  "/:id/reject",
  validateToken,
  checkRole(["admin", "coach"]),
  quitPlanController.rejectQuitPlan
);

quitPlanRouter.post(
  "/request",
  validateToken,
  checkSubscriptionAccess(["plus", "premium"]),
  checkRole(["user", "coach", "admin"]),
  quitPlanController.sendQuitPlanRequest
);

quitPlanRouter.get(
  "/request/mine",
  validateToken,
  checkSubscriptionAccess(["plus", "premium"]),
  quitPlanController.getMyQuitPlanRequests
);

quitPlanRouter.delete(
  "/request/:id",
  validateToken,
  checkSubscriptionAccess(["plus", "premium"]),
  quitPlanController.cancelQuitPlanRequest
);

quitPlanRouter.post(
  "/user/use/:id",
  validateToken,
  quitPlanController.usePublicPlan
);

quitPlanRouter.get(
  "/requests/my-coach/:id",
  validateToken,
  quitPlanController.getRequestsByCoachId
);
// routes/quitPlan.routes.js
quitPlanRouter.get(
  "/coach/my-plans",
  validateToken,
  checkRole(["coach"]),
  quitPlanController.getQuitPlansByCoach
);

quitPlanRouter.post(
  "/public",
  validateToken,
  quitPlanController.createPublicPlan
);
quitPlanRouter.put(
  "/:id/toggle-public",
  validateToken,
  quitPlanController.togglePlanPublicStatus
);

module.exports = quitPlanRouter;
