const Progress = require("../models/progress.model");
const Stage = require("../models/stage.model");
const QuitPlan = require("../models/quitPlan.model");
const checkAndAwardBadges = require("../utils/badgeCheck");
const SmokingStatus = require("../models/smokingStatus.model");
const {
  getPlanProgress,
  getTaskProgressInStage,
} = require("../utils/progressStats");
const getUserProgressStats = require("../utils/userStats");
const { triggerTrainingForUser } = require("../services/ai.service");
// Helper: Kiểm tra quyền truy cập vào stage (dựa trên plan → user_id)
const canAccessStage = async (user, stageId) => {
  const stage = await Stage.findById(stageId);
  if (!stage) return { allowed: false, reason: "Stage not found" };

  const plan = await QuitPlan.findById(stage.plan_id);
  if (!plan) return { allowed: false, reason: "Quit plan not found" };

  const isOwner = plan.user_id.toString() === user.id;
  const isCoach = user.role === "coach";
  const isAdmin = user.role === "admin";

  return {
    allowed: isOwner || isCoach || isAdmin,
    isOwner,
    isCoach,
    isAdmin,
    stage,
    plan,
  };
};

// ✅ Create progress (User only for their stage)
exports.createProgress = async (req, res) => {
  try {
    const { stage_id, date, cigarettes_smoked, health_status, user_id } =
      req.body;

    const access = await canAccessStage(req.user, stage_id);
    if (!access.allowed) {
      return res.status(403).json({ message: "Access denied" });
    }

    const isAdminOrCoach = ["admin", "coach"].includes(req.user.role);
    const finalUserId = isAdminOrCoach && user_id ? user_id : req.user.id;

    const inputDate = new Date(date);

    // Check đã có progress trong cùng ngày chưa
    // const existing = await Progress.findOne({
    //   user_id: finalUserId,
    //   stage_id,
    //   date: {
    //     $gte: new Date(inputDate.setHours(0, 0, 0, 0)),
    //     $lte: new Date(inputDate.setHours(23, 59, 59, 999)),
    //   },
    // });

    // if (existing) {
    //   return res
    //     .status(400)
    //     .json({ message: "Đã có tiến trình được ghi nhận trong ngày này" });
    // }

    const smokingStatus = await SmokingStatus.findOne({
      user_id: finalUserId,
    }).sort({ createdAt: -1 });
    if (!smokingStatus) {
      return res
        .status(400)
        .json({ error: "Chưa có trạng thái hút thuốc ban đầu" });
    }

    const costPerCigarette = smokingStatus.cost_per_pack / 20;
    const expectedCost = smokingStatus.cigarettes_per_day * costPerCigarette;
    const actualCost = cigarettes_smoked * costPerCigarette;
    const money_saved = Math.max(expectedCost - actualCost, 0);

    const progress = await Progress.create({
      user_id: finalUserId,
      stage_id,
      date: inputDate,
      cigarettes_smoked,
      health_status,
      money_saved,
    });
    await checkAndAwardBadges(finalUserId);

    triggerTrainingForUser(finalUserId);

    res.status(201).json(progress);
  } catch (err) {
    console.error("Error in createProgress:", err);
    res
      .status(400)
      .json({ message: "Error creating progress", error: err.message });
  }
};

// ✅ Get progress for a stage — Owner, Coach, Admin
exports.getProgressByStage = async (req, res) => {
  try {
    const { stageId } = req.params;

    const access = await canAccessStage(req.user, stageId);
    if (!access.allowed) {
      return res.status(403).json({ message: "Access denied" });
    }

    const progress = await Progress.find({ stage_id: stageId })
      .populate("user_id", "name email avatar_url")
      .populate(
        "stage_id",
        "title description stage_number start_date end_date"
      );
    res.status(200).json(progress);
  } catch (err) {
    res.status(400).json({ message: "Error fetching progress", err });
  }
};
exports.getProgressById = async (req, res) => {
  try {
    const progress = await Progress.findById(req.params.id);
    if (!progress) return res.status(404).json({ message: "Not found" });

    const isOwner = progress.user_id.toString() === req.user.id;
    const isCoach = req.user.role === "coach";
    const isAdmin = req.user.role === "admin";

    if (!(isOwner || isCoach || isAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }

    res
      .status(200)
      .json(progress)
      .populate("user_id", "name email avatar_url")
      .populate(
        "stage_id",
        "title description stage_number start_date end_date"
      );
  } catch (err) {
    res.status(400).json({ message: "Error", err });
  }
};
exports.updateProgress = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { stage_id, date, cigarettes_smoked, health_status } = req.body;
    const progress = await Progress.findById(req.params.id);
    if (!progress) return res.status(404).json({ message: "Not found" });

    if (progress.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not your progress" });
    }
    const smokingStatus = await SmokingStatus.findOne({ user_id }).sort({
      createdAt: -1,
    });
    if (!smokingStatus) {
      return res
        .status(400)
        .json({ error: "Chưa có trạng thái hút thuốc ban đầu" });
    }

    const costPerCigarette = smokingStatus.cost_per_pack / 20;
    const expectedCost = smokingStatus.cigarettes_per_day * costPerCigarette;
    const actualCost = cigarettes_smoked * costPerCigarette;
    const money_saved = Math.max(expectedCost - actualCost, 0);

    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);
    const updated = await Progress.findOneAndUpdate(
      { user_id, stage_id },
      {
        $set: {
          cigarettes_smoked,
          money_saved,
          health_status,
          date: cleanDate
        },
      },
      { new: true, upsert: true }
    );
    //Gọi gán huy hiệu sau khi cập nhật
    await checkAndAwardBadges(user_id);

    trainModelForUser(user_id).catch(err => console.error(`[AI Training BG] Lỗi khi huấn luyện cho user ${user_id}:`, err));

    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", err });
  }
};

exports.deleteProgress = async (req, res) => {
  try {
    const progress = await Progress.findById(req.params.id);
    if (!progress) return res.status(404).json({ message: "Not found" });

    const isOwner = progress.user_id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!(isOwner || isAdmin)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Progress.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ message: "Delete failed", err });
  }
};

exports.getAllProgress = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === "user") {
      query = { user_id: req.user.id };
    }

    const progress = await Progress.find(query)
      .populate("user_id", "name email avatar_url")
      .populate({
        path: "stage_id",
        populate: {
          path: "plan_id",
          select: "name",
        },
        select: "name plan_id",
      });

    res.status(200).json(progress);
  } catch (err) {
    console.error("❌ Error in getAllProgress:", err);
    res.status(500).json({ message: "Error fetching progress records", err });
  }
};

// API: Tiến độ tổng thể của user (qua nhiều plan)
exports.getUserOverallProgress = async (req, res) => {
  try {
    const user_id = req.params.id;

    const plans = await QuitPlan.find({ user_id });
    const planProgressList = [];

    let totalPercent = 0;

    for (const plan of plans) {
      const percent = await getPlanProgress(plan._id);
      totalPercent += percent;

      planProgressList.push({
        plan_id: plan._id,
        plan_name: plan.name,
        progress_percent: percent,
      });
    }

    const overall =
      plans.length > 0 ? Math.round(totalPercent / plans.length) : 0;

    res.json({
      overall_progress_percent: overall,
      plans: planProgressList,
    });
  } catch (err) {
    console.error("Lỗi khi lấy tiến độ:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// API: Tiến độ của 1 kế hoạch cụ thể
exports.getSinglePlanProgress = async (req, res) => {
  try {
    const plan_id = req.params.id;
    const plan = await QuitPlan.findById(plan_id);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    if (req.user.role !== "admin" && plan.user_id.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Không có quyền truy cập kế hoạch này" });
    }

    const { totalStages, completedStages, progress_percent } =
      await getPlanProgress(plan_id);

    res.json({
      plan_id,
      plan_name: plan.name,
      total_stages: totalStages,
      completed_stages: completedStages,
      progress_percent: progress_percent,
    });
  } catch (err) {
    console.error("Lỗi khi lấy tiến độ kế hoạch:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

//API: Tiến độ 1 stage cụ thể
exports.getSingleStageProgress = async (req, res) => {
  try {
    const user_id = req.user.id;
    const stage_id = req.params.id;

    const percent = await getTaskProgressInStage(stage_id, user_id);

    res.json({
      stage_id,
      progress_percent: percent,
    });
  } catch (err) {
    console.error("Lỗi khi lấy tiến độ stage:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Lấy chỉ số chuỗi ngày không hút thuốc liên tục của user
module.exports.getConsecutiveNoSmokeDays = async (req, res) => {
  try {
    const userId = req.params.id;
    // Chỉ cho phép chính user, coach hoặc admin truy cập
    if (
      req.user.id !== userId &&
      req.user.role !== "coach" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Access denied" });
    }
    const stats = await getUserProgressStats(userId);
    res.status(200).json({
      user_id: userId,
      consecutive_no_smoke_days: stats.consecutive_no_smoke_days,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error fetching stats", error: err.message });
  }
};

exports.getTotalMoneySavedInPlan = async (req, res) => {
  try {
    const plan_id = req.params.id;
    const plan = await QuitPlan.findById(plan_id);

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Kiểm tra quyền truy cập
    if (req.user.role !== "admin" && plan.user_id.toString() !== req.user.id) {
      return res.status(403).json({
        error: "Không có quyền truy cập kế hoạch này"
      });
    }

    // Lấy tất cả các stages trong plan
    const stages = await Stage.find({ plan_id });
    const stageIds = stages.map(stage => stage._id);

    // Tính tổng tiền tiết kiệm từ tất cả progress trong các stages
    const totalMoneySaved = await Progress.aggregate([
      {
        $match: {
          stage_id: { $in: stageIds },
          user_id: plan.user_id
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$money_saved" }
        }
      }
    ]);

    res.json({
      plan_id,
      plan_name: plan.name,
      total_money_saved: totalMoneySaved[0]?.total || 0
    });

  } catch (err) {
    console.error("Lỗi khi tính tổng tiền tiết kiệm:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};