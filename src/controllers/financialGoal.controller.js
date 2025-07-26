const FinancialGoal = require("../models/financialGoal.model");
const Progress = require("../models/progress.model");
const QuitPlan = require("../models/quitPlan.model");

/**
 * Kiểm tra xem Coach có quản lý User không (dựa vào QuitPlan)
 */
const checkCoachOwnsUser = async (coachId, userId) => {
  const plan = await QuitPlan.findOne({ coach_id: coachId, user_id: userId });
  return !!plan;
};

/**
 
 * Lấy mục tiêu tài chính của chính user
 */
exports.getMyGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    const goals = await FinancialGoal.find({ user_id: userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(goals);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy mục tiêu của bạn", error });
  }
};

/**
 * Coach lấy mục tiêu của học viên mình quản lý | Admin lấy bất kỳ
 */
exports.getGoalsByUser = async (req, res) => {
  try {
    const { role, id: currentUserId } = req.user;
    const targetUserId = req.params.id;

    if (role === "coach") {
      const isManaging = await checkCoachOwnsUser(currentUserId, targetUserId);
      if (!isManaging) {
        return res
          .status(403)
          .json({ message: "Bạn không quản lý học viên này." });
      }
    }

    const goals = await FinancialGoal.find({ user_id: targetUserId }).sort({
      createdAt: -1,
    });
    res.status(200).json(goals);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy mục tiêu người dùng", error });
  }
};

/**
 * Trả về số tiền đã tiết kiệm + % đạt mục tiêu
 */
exports.getGoalProgress = async (req, res) => {
  try {
    const goal = await FinancialGoal.findById(req.params.id);
    if (!goal)
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });

    const progress = await Progress.findById(goal.progress_id);
    if (!progress) {
      return res.status(200).json({
        money_saved: 0,
        percentage: 0,
        note: "Chưa có dữ liệu tiết kiệm",
      });
    }

    const moneySaved = progress.money_saved || 0;
    const percentage = Math.min(
      (moneySaved / goal.target_amount) * 100,
      100
    ).toFixed(2);

    res.status(200).json({
      money_saved: moneySaved,
      percentage: parseFloat(percentage),
    });
  } catch (error) {
    console.error("Lỗi khi lấy tiến trình tiết kiệm:", error);
    res.status(500).json({ message: "Lỗi server", error });
  }
};

/**
 * Tạo mục tiêu tiết kiệm mới
 */
exports.createGoal = async (req, res) => {
  try {
    const { title, target_amount } = req.body;
    const user_id = req.user.id;

    // Tìm progress hiện tại của user
    const progress = await Progress.findOne({ user_id });
    if (!progress) {
      return res.status(400).json({
        message: "Bạn chưa có tiến trình nào để liên kết với mục tiêu",
      });
    }

    const goal = await FinancialGoal.create({
      user_id,
      progress_id: progress._id,
      title,
      target_amount,
      status: "active",
    });

    res.status(201).json(goal);
  } catch (error) {
    console.error("Lỗi khi tạo goal:", error);
    res.status(500).json({ message: "Lỗi server", error });
  }
};

/**
 * Cập nhật mục tiêu tiết kiệm
 */
exports.updateGoal = async (req, res) => {
  try {
    const goal = await FinancialGoal.findById(req.params.id);
    if (!goal)
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });

    const { id: currentUserId, role } = req.user;

    if (role === "user" && goal.user_id.toString() !== currentUserId) {
      return res
        .status(403)
        .json({ message: "Không thể cập nhật mục tiêu của người khác" });
    }

    if (role === "coach") {
      const isManaging = await checkCoachOwnsUser(
        currentUserId,
        goal.user_id.toString()
      );
      if (!isManaging) {
        return res
          .status(403)
          .json({ message: "Không thể cập nhật mục tiêu của học viên này" });
      }
    }

    const { title, target_amount, status } = req.body;

    if (title !== undefined) goal.title = title;
    if (target_amount !== undefined) goal.target_amount = target_amount;
    if (status !== undefined) goal.status = status;

    const updated = await goal.save();
    res.status(200).json(updated);
  } catch (error) {
    console.error("Lỗi khi cập nhật mục tiêu:", error);
    res.status(500).json({ message: "Lỗi server", error });
  }
};

/**
 * Xoá mục tiêu tiết kiệm
 */
exports.deleteGoal = async (req, res) => {
  try {
    const goal = await FinancialGoal.findById(req.params.id);
    if (!goal)
      return res.status(404).json({ message: "Không tìm thấy mục tiêu" });

    const { id: currentUserId, role } = req.user;

    if (role === "user" && goal.user_id.toString() !== currentUserId) {
      return res
        .status(403)
        .json({ message: "Không thể xoá mục tiêu của người khác" });
    }

    if (role === "coach") {
      const isManaging = await checkCoachOwnsUser(
        currentUserId,
        goal.user_id.toString()
      );
      if (!isManaging) {
        return res
          .status(403)
          .json({ message: "Không thể xoá mục tiêu của học viên này" });
      }
    }

    await FinancialGoal.findByIdAndDelete(goal._id);
    res.status(200).json({ message: "Đã xoá mục tiêu thành công" });
  } catch (error) {
    console.error("Lỗi khi xoá mục tiêu:", error);
    res.status(500).json({ message: "Lỗi server", error });
  }
};
