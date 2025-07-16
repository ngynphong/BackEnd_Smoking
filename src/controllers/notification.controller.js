const Notification = require("../models/notificaltion.model");
const Progress = require("../models/progress.model"); // Import model tiến trình
const QuitPlan = require("../models/quitPlan.model");
const Stage = require("../models/stage.model");
const Task = require("../models/task.model");

exports.createNotification = async (req, res) => {
  try {
    const { progress_id, message, type, user_id } = req.body;
    const schedule = new Date();

    if (req.user.role !== "admin" && req.user.role !== "coach") {
      return res
        .status(403)
        .json({ error: "Only admin or coach can send notifications" });
    }

    if (!message || !type || (!user_id && !progress_id)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let finalUserId = user_id;

    // Nếu có progress_id → lấy user từ progress
    if (progress_id) {
      const progress = await require("../models/progress.model").findById(
        progress_id
      );
      if (!progress) {
        return res.status(404).json({ error: "Progress not found" });
      }
      finalUserId = progress.user_id;
    }

    const newNotification = new Notification({
      user_id: finalUserId,
      progress_id: progress_id || undefined,
      message,
      type,
      schedule,
    });

    const saved = await newNotification.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [2] Lấy tất cả Notifications
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find();
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [3] Lấy Notification theo ID
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [4] Cập nhật Notification
exports.updateNotification = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// [5] Xoá Notification
exports.deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /notifications/user/:userId
exports.getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Đảm bảo người yêu cầu là chính người dùng đó, hoặc là coach/admin.
    if (req.user.id !== userId && req.user.role === 'user') {
      return res.status(403).json({ message: 'Bạn không có quyền xem thông báo của người dùng này.' });
    }

    const notifications = await Notification.find({ user_id: userId })
      .populate('progress_id') 
      .sort({ createdAt: -1 }); 

    res.status(200).json(notifications);

  } catch (err) {
    console.error("Lỗi khi lấy thông báo của người dùng:", err.message);
    res.status(500).json({ error: "Lỗi máy chủ", details: err.message });
  }
};
// ✅ API: Coach xem tất cả học viên mình quản lý và thông tin tiến trình
exports.getMyStudentsWithProgress = async (req, res) => {
  try {
    if (req.user.role !== "coach") {
      return res.status(403).json({ message: "Only coaches can access this" });
    }

    const quitPlans = await QuitPlan.find({ coach_id: req.user.id }).populate(
      "user_id"
    );
    const result = [];

    for (const plan of quitPlans) {
      const stages = await Stage.find({ plan_id: plan._id });

      for (const stage of stages) {
        const progress = await Progress.findOne({
          user_id: plan.user_id._id,
          stage_id: stage._id,
        });

        const tasks = await Task.find({ stage_id: stage._id });

        let notifications = [];

        if (progress) {
          // Nếu có tiến trình thì tìm các notification liên quan
          notifications = await Notification.find({
            progress_id: progress._id,
          }).sort({ createdAt: -1 });
        } else {
          // Nếu chưa có tiến trình → tìm theo user và loại nhắc nhở
          notifications = await Notification.find({
            user_id: plan.user_id._id,
            type: "reminder",
            progress_id: { $exists: false },
          }).sort({ createdAt: -1 });
        }

        result.push({
          user: plan.user_id,
          quit_plan: plan,
          stage,
          tasks,
          progress,
          notifications, // ✅ Gắn vào đây
        });
      }
    }

    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching students", error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        user_id: req.user.id,
        is_read: false
      },
      {
        $set: { is_read: true }
      }
    );

    res.status(200).json({ message: "Thông báo đã được đánh dấu là đã đọc" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi đánh dấu thông báo là đã đọc", error });
  }
};