const Task = require("../models/task.model");
const TaskResult = require("../models/TaskResult.model");
const Stage = require("../models/stage.model");
// Lấy tất cả task (có thể filter theo stage_id nếu cần)
exports.getAllTasks = async (req, res) => {
  try {
    const { stage_id } = req.query;
    const filter = stage_id ? { stage_id } : {};

    const tasks = await Task.find(filter).sort({ sort_order: 1 });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách task", error });
  }
};

// Lấy task theo ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Không tìm thấy task" });
    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy task", error });
  }
};

// Tạo task mới
exports.createTask = async (req, res) => {
  try {
    const { stage_id, title, description, sort_order } = req.body;

    const newTask = new Task({
      stage_id,
      title,
      description,
      sort_order,
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi tạo task", error });
  }
};

// Cập nhật task
exports.updateTask = async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!updatedTask)
      return res.status(404).json({ message: "Task không tồn tại" });

    res.status(200).json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi cập nhật task", error });
  }
};

// Xóa task
exports.deleteTask = async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask)
      return res.status(404).json({ message: "Task không tồn tại" });

    res.status(200).json({ message: "Đã xóa task thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa task", error });
  }
};
exports.getTasksByStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const tasks = await Task.find({ stage_id: stageId }).sort({
      sort_order: 1,
    });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách task", error });
  }
};

module.exports.completeTask = async (req, res) => {
  try {
    const task_id = req.params.id;
    const user_id = req.user.id;

    // 1. Lấy task để biết stage_id
    const task = await Task.findById(task_id);
    if (!task) return res.status(404).json({ message: "Task không tồn tại" });

    const stage = await Stage.findById(task.stage_id); // Cần lấy thông tin của stage
    if (!stage) return res.status(404).json({ message: "Giai đoạn không tồn tại" });

    // 2. Cập nhật hoặc tạo mới taskResult
    const taskResult = await TaskResult.findOneAndUpdate(
      { task_id, user_id, stage_id: task.stage_id, attempt_number: stage.attempt_number }, // Thêm attempt_number vào query
      { is_completed: true },
      { upsert: true, new: true }
    );

    // 3. Kiểm tra xem tất cả task của stage này đã hoàn thành chưa
    // const allTasks = await Task.find({ stage_id: task.stage_id });
    // const totalTasks = allTasks.length;

    // const completedResults = await TaskResult.find({
    //   user_id,
    //   stage_id: task.stage_id,
    //   is_completed: true,
    // });

    // const completedCount = completedResults.length;

    // if (totalTasks > 0 && completedCount === totalTasks) {
    //   // Cập nhật Stage là đã hoàn thành
    //   await Stage.findByIdAndUpdate(task.stage_id, { is_completed: true });
    // }

    res.json({
      message: "Hoàn thành task thành công",
      taskResult,
      stage_completed: totalTasks > 0 && completedCount === totalTasks,
    });
  } catch (err) {
    console.error("Lỗi cập nhật task:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

//Xem task đã hoàn thành của 1 stage cụ thể
module.exports.getCompletedTasksByStage = async (req, res) => {
  try{
    const user_id = req.user.id;
    const stage_id = req.params.id;

    const completedTasks = await TaskResult.find({
      user_id,
      stage_id,
      is_completed: true,
    });

    res.status(200).json(completedTasks);
  } catch (err) {
    console.error("Lỗi khi lấy task đã hoàn thành:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};