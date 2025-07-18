const express = require("express");
const subscriptionRouter = express.Router();
const subscriptionController = require("../controllers/subscription.controller");
const { validateToken, checkRole } = require("../middlewares/AuthMiddleware");

subscriptionRouter.get('/my-active-subscription', validateToken, subscriptionController.MyActiveSubscription);

// [POST] Create
subscriptionRouter.post(
  "/",
  validateToken,
  subscriptionController.createSubscription
);
// subscriptionRouter.post(
//   "/",
//   validateToken,
//   subscriptionController.createSubscription
// );

// [GET] All subscriptions
subscriptionRouter.get(
  "/",
  validateToken,
  checkRole(["admin", "coach"]),
  subscriptionController.getAllSubscriptions
);

// [GET] One subscription
subscriptionRouter.get(
  "/:id",
  validateToken,
  checkRole(["user", "admin", "coach"]),
  subscriptionController.getSubscriptionById
);

// [PUT] Update
subscriptionRouter.put(
  "/:id",
  validateToken,
  checkRole(["admin"]),
  subscriptionController.updateSubscription
);

// [DELETE] Delete
subscriptionRouter.delete(
  "/:id",
  validateToken,
  checkRole(["admin"]),
  subscriptionController.deleteSubscription
);

module.exports = subscriptionRouter;
