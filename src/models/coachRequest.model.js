const mongoose = require("mongoose");

const coachRequestSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sent_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // admin hoặc coach gửi
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    description: {
      type: String,
      required: false,
      default:
        "Bạn đã hoàn thành hành trình cai thuốc rất tốt. Chúng tôi muốn mời bạn trở thành Coach giúp người khác.",
    },
    title: {
      type: String,
      required: false,
      default: "Lời mời trở thành Coach",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoachRequest", coachRequestSchema);
