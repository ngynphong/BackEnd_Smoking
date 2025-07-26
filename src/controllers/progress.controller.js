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
const TaskResult = require("../models/TaskResult.model"); // <-- Thêm import này
const Notification = require("../models/notificaltion.model");

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

/**
 * Xử lý logic khi một giai đoạn cần được "thử lại".
 * @param {object} stage - Document của giai đoạn cần reset.
 * @param {object} plan - Document của kế hoạch chứa giai đoạn đó.
 */
async function handleStageRetry(stage, plan) {
  const previousAttempt = stage.attempt_number;
  stage.attempt_number += 1; // Tăng số lần thử

  // Xóa tất cả các TaskResult của lần thử trước
  await TaskResult.deleteMany({
    stage_id: stage._id,
    user_id: plan.user_id,
    attempt_number: previousAttempt
  });

  // Lưu lại giai đoạn đã cập nhật
  await stage.save();
  console.log(`[Stage Retry] Giai đoạn ${stage.title} của user ${plan.user_id} đã được làm mới, lần thử #${stage.attempt_number}`);

  // Tạo thông báo cho người dùng
  await Notification.create({
    user_id: plan.user_id,
    message: `Bạn đã vượt giới hạn thuốc cho giai đoạn "${stage.title}". Đừng lo, giai đoạn đã được làm mới để bạn bắt đầu lại. Cố lên!`,
    type: 'stage_retry',
    is_sent: true
  });

  // Tạo thông báo cho coach (nếu có)
  if (plan.coach_id) {
    await Notification.create({
      user_id: plan.coach_id,
      message: `Người dùng ${plan.user_id.name} đã cần thử lại giai đoạn "${stage.title}". Hãy vào xem và hỗ trợ họ nhé.`,
      type: 'user_alert',
      is_sent: true
    });
  }
}

// ✅ Create progress (User only for their stage)
exports.createProgress = async (req, res) => {
  try {
    const { stage_id, date, cigarettes_smoked, health_status, user_id } =
      req.body;

    const access = await canAccessStage(req.user, stage_id);
    if (!access.allowed) {
      return res.status(403).json({ message: "Access denied" });
    }
    const currentStage = access.stage; 
    const isAdminOrCoach = ["admin", "coach"].includes(req.user.role);
    const finalUserId = isAdminOrCoach && user_id ? user_id : req.user.id;

    const progressDate = new Date(date);
    const stageStartDate = new Date(currentStage.start_date);
    const stageEndDate = new Date(currentStage.end_date);

    // 1. Đặt giờ về 0 để so sánh ngày cho chính xác
    progressDate.setHours(0, 0, 0, 0);
    stageStartDate.setHours(0, 0, 0, 0);
    stageEndDate.setHours(0, 0, 0, 0);

    // 2. Kiểm tra xem ngày ghi nhận có nằm trong khoảng thời gian của giai đoạn không
    if (progressDate < stageStartDate || progressDate > stageEndDate) {
      return res.status(400).json({
        message: `Ngày ghi nhận tiến trình (${progressDate.toLocaleDateString('vi-VN')}) phải nằm trong khoảng thời gian của giai đoạn (từ ${stageStartDate.toLocaleDateString('vi-VN')} đến ${stageEndDate.toLocaleDateString('vi-VN')}).`
      });
    }

    const inputDate = new Date(date);

    // Check đã có progress trong cùng ngày chưa
    const existing = await Progress.findOne({
      user_id: finalUserId,
      stage_id,
      date: {
        $gte: new Date(inputDate.setHours(0, 0, 0, 0)),
        $lte: new Date(inputDate.setHours(23, 59, 59, 999)),
      },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Đã có tiến trình được ghi nhận trong ngày này" });
    }

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
      attempt_number: currentStage.attempt_number
    });

    const stage = await Stage.findById(stage_id).populate({ path: 'plan_id', populate: { path: 'user_id', select: 'name' } });
    // Chỉ kiểm tra nếu coach có đặt giới hạn
    if (stage && stage.cigarette_limit != null) {
      // Tính tổng số điếu đã hút trong lần thử hiện tại của giai đoạn
      const stats = await Progress.aggregate([
        { $match: { stage_id: stage._id, user_id: stage.plan_id.user_id._id, attempt_number: currentStage.attempt_number } }, // Chỉ tính progress trong lần thử hiện tại
        { $group: { _id: null, total: { $sum: "$cigarettes_smoked" } } }
      ]);

      const totalSmokedInAttempt = stats[0]?.total || 0;

      // Kiểm tra nếu vượt ngưỡng
      if (totalSmokedInAttempt > stage.cigarette_limit) {
        await handleStageRetry(stage, stage.plan_id);
      }
      // Gửi cảnh báo nếu đạt 80%
      else if (totalSmokedInAttempt >= stage.cigarette_limit * 0.8) {
        await Notification.create({
          user_id: stage.plan_id.user_id,
          message: `Cảnh báo: Bạn đã sử dụng gần hết giới hạn thuốc cho giai đoạn "${stage.title}". Hãy thật cẩn thận nhé!`,
          type: 'stage_warning',
          is_sent: true
        });
      }
    }

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

exports.getPlanSmokingStats = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user.id; // Lấy từ token để đảm bảo an toàn

    // 1. Lấy thông tin kế hoạch để xác thực và lấy user_id
    const plan = await QuitPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy kế hoạch." });
    }

    // 2. Kiểm tra quyền truy cập
    if (req.user.role === 'user' && plan.user_id.toString() !== userId) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập thông tin này." });
    }

    // 3. Lấy trạng thái hút thuốc ban đầu của người dùng để tính toán
    const smokingStatus = await SmokingStatus.findOne({ user_id: plan.user_id }).sort({ createdAt: -1 });
    if (!smokingStatus) {
      return res.status(400).json({ message: "Không tìm thấy trạng thái hút thuốc ban đầu của người dùng." });
    }

    // 4. Lấy tất cả các stage thuộc kế hoạch này
    const stages = await Stage.find({ plan_id: planId });
    const stageIds = stages.map(stage => stage._id);

    // 5. Tính tổng số điếu thuốc THỰC TẾ đã hút trong tất cả các stage
    const aggregateResult = await Progress.aggregate([
      {
        $match: {
          user_id: plan.user_id,
          stage_id: { $in: stageIds }
        }
      },
      {
        $group: {
          _id: null,
          totalActuallySmoked: { $sum: "$cigarettes_smoked" },
          // Đếm số ngày đã có ghi nhận progress
          daysRecorded: { $sum: 1 }
        }
      }
    ]);

    const totalActuallySmoked = aggregateResult.length > 0 ? aggregateResult[0].totalActuallySmoked : 0;
    const daysRecorded = aggregateResult.length > 0 ? aggregateResult[0].daysRecorded : 0;

    // 6. Tính số điếu thuốc DỰ KIẾN sẽ hút nếu không cai
    // Lấy số ngày đã ghi nhận progress * số điếu thuốc hút mỗi ngày lúc ban đầu
    const totalExpectedSmoked = daysRecorded * (smokingStatus.cigarettes_per_day || 0);

    // 7. Tính số điếu thuốc đã GIẢM được
    const totalCigarettesReduced = Math.max(0, totalExpectedSmoked - totalActuallySmoked);

    res.status(200).json({
      plan_id: planId,
      user_id: plan.user_id,
      total_cigarettes_smoked: totalActuallySmoked,
      total_cigarettes_expected: totalExpectedSmoked,
      total_cigarettes_reduced: totalCigarettesReduced
    });

  } catch (error) {
    console.error("Lỗi khi lấy thống kê kế hoạch hút thuốc:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

exports.getPlanStageChartsData = async (req, res) => {
  try {
    const { planId } = req.params;

    // 1. Lấy thông tin kế hoạch và người dùng
    const plan = await QuitPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy kế hoạch." });
    }

    const userId = plan.user_id;

    // 2. Lấy thông tin hút thuốc ban đầu của người dùng
    const smokingStatus = await SmokingStatus.findOne({ user_id: userId }).sort({ createdAt: -1 });
    if (!smokingStatus) {
      return res.status(404).json({ message: "Không tìm thấy trạng thái hút thuốc ban đầu của người dùng." });
    }
    const baselineCigarettesPerDay = smokingStatus.cigarettes_per_day || 0;

    // 3. Lấy tất cả các giai đoạn của kế hoạch
    const stages = await Stage.find({ plan_id: planId }).sort("stage_number").lean();

    // 4. Lặp qua từng giai đoạn để tính toán dữ liệu
    const chartData = await Promise.all(stages.map(async (stage) => {
      const stats = await Progress.aggregate([
        {
          $match: {
            stage_id: stage._id,
            user_id: userId
          }
        },
        {
          $group: {
            _id: null,
            total_cigarettes_smoked: { $sum: "$cigarettes_smoked" },
            total_money_saved: { $sum: "$money_saved" },
            days_recorded: { $sum: 1 } // Đếm số ngày đã ghi nhận
          }
        }
      ]);

      const stageStats = stats[0] || {}; // Lấy kết quả hoặc một object rỗng
      const daysRecorded = stageStats.days_recorded || 0;
      const totalSmoked = stageStats.total_cigarettes_smoked || 0;

      // Tính toán số điếu thuốc dự kiến sẽ hút
      const expectedSmoked = daysRecorded * baselineCigarettesPerDay;
      // Tính toán số điếu thuốc đã tránh được
      const avoidedSmoked = Math.max(0, expectedSmoked - totalSmoked);

      return {
        stage_id: stage._id,
        stage_title: stage.title,
        stage_number: stage.stage_number,
        total_cigarettes_smoked: totalSmoked,
        total_cigarettes_avoided: avoidedSmoked,
        total_money_saved: Math.round(stageStats.total_money_saved) || 0,
      };
    }));

    res.status(200).json(chartData);

  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu biểu đồ giai đoạn:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};