const mongoose = require("mongoose");

const financialGoalSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    progress_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Progress",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },
    target_amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FinancialGoal", financialGoalSchema);
