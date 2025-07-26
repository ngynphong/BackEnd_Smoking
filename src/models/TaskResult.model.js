const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const taskResultSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    task_id: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    stage_id: { type: Schema.Types.ObjectId, ref: "Stage", required: true },
    is_completed: { type: Boolean, default: false },
    attempt_number: { type: Number, required: true }
  },
  { timestamps: true }
);

const TaskResult = mongoose.model("TaskResult", taskResultSchema);
module.exports = TaskResult;
