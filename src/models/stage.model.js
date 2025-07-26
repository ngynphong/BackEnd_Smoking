const mongoose = require("mongoose");

const stageSchema = new mongoose.Schema(
  {
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuitPlan",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    stage_number: {
      type: Number,
      required: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    is_completed: {
      type: Boolean,
      default: false,
    },
    cigarette_limit: {
      // Giới hạn số điếu thuốc cho cả giai đoạn
      type: Number,
      required: true,
      min: 0,
    },
    attempt_number: {
      // Theo dõi số lần thử lại
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

const Stage = mongoose.model("Stage", stageSchema);
module.exports = Stage;
