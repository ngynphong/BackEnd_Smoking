const mongoose = require("mongoose");

const quitPlanSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coach_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    reason: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    target_quit_date: {
      type: Date,
      required: true,
    },
    image: {
      type: String,
      required: false, // không bắt buộc
    },
    status: {
      type: String,
      enum: ["approved"],
      default: "approved", // Mặc định luôn được duyệt khi tạo
    },
    is_public: {
      type: Boolean,
      default: false,
    },
    cloned_from_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuitPlan",
      required: false, // Chỉ yêu cầu khi đây là một bản sao
    },
  },
  { timestamps: true }
);

const QuitPlan = mongoose.model("QuitPlan", quitPlanSchema);
module.exports = QuitPlan;
