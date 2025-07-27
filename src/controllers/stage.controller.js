const Stage = require("../models/stage.model");
const QuitPlan = require("../models/quitPlan.model");
const Progress = require("../models/progress.model");

// 🔐 Helper: Check quyền truy cập Stage theo QuitPlan
const canAccessPlan = async (user, planId) => {
  const plan = await QuitPlan.findById(planId);
  if (!plan) return { allowed: false, reason: "Quit plan not found" };

  const isOwner = plan.user_id.toString() === user.id;
  const isCoach = user.role === "coach";
  const isAdmin = user.role === "admin";

  return {
    allowed: isAdmin || isCoach || isOwner,
    plan,
    isOwner,
    isCoach,
    isAdmin,
  };
};

// ✅ Create Stage — Coach, Admin
exports.createStage = async (req, res) => {
  try {
    const {
      plan_id,
      title,
      description,
      start_date,
      end_date,
      cigarette_limit,
    } = req.body;

    // 1. Kiểm tra ngày bắt đầu phải trước ngày kết thúc
    if (new Date(start_date) >= new Date(end_date)) {
      return res
        .status(400)
        .json({ message: "Ngày bắt đầu phải trước ngày kết thúc giai đoạn." });
    }

    // 2. Tìm giai đoạn cuối cùng của kế hoạch này để kiểm tra tính tuần tự
    const lastStage = await Stage.findOne({ plan_id }).sort({
      stage_number: -1,
    });

    if (lastStage) {
      // Nếu đã có giai đoạn trước đó, ngày bắt đầu của giai đoạn mới phải sau ngày kết thúc của giai đoạn cũ
      if (new Date(start_date) <= new Date(lastStage.end_date)) {
        return res.status(400).json({
          message: `Ngày bắt đầu của giai đoạn mới (${new Date(
            start_date
          ).toLocaleDateString(
            "vi-VN"
          )}) phải sau ngày kết thúc của giai đoạn trước đó (${new Date(
            lastStage.end_date
          ).toLocaleDateString("vi-VN")}).`,
        });
      }
    }

    const access = await canAccessPlan(req.user, plan_id);

    if (!access.allowed || (!access.isCoach && !access.isAdmin)) {
      return res
        .status(403)
        .json({ message: "Only coach or admin can create stages" });
    }

    // 🔢 Tự động tính stage_number dựa vào số lượng hiện tại
    const count = await Stage.countDocuments({ plan_id });

    const newStage = await Stage.create({
      plan_id,
      title,
      description,
      stage_number: count + 1, // tự động gán
      start_date,
      end_date,
      cigarette_limit,
      is_completed: false,
    });

    res.status(201).json(newStage);
  } catch (error) {
    res.status(400).json({ message: "Error creating stage", error });
  }
};

// ✅ Get all stages for a plan — Owner, Coach, Admin
exports.getStagesByPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    // Lấy thông tin kế hoạch để có user_id
    const plan = await QuitPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy kế hoạch." });
    }

    // 1. Lấy danh sách các giai đoạn như bình thường
    const stages = await Stage.find({ plan_id: planId })
      .sort("stage_number")
      .lean(); // Dùng .lean() để tăng hiệu suất
    // 2. Lặp qua từng giai đoạn để tính toán và bổ sung thông tin
    const stagesWithProgress = await Promise.all(
      stages.map(async (stage) => {
        // Tính tổng số điếu thuốc đã hút trong lần thử hiện tại của giai đoạn
        const stats = await Progress.aggregate([
          {
            // Lọc progress của đúng user, đúng stage, và chỉ tính từ lần "thử lại" gần nhất
            $match: {
              user_id: plan.user_id,
              stage_id: stage._id,
              attempt_number: stage.attempt_number, // <-- Dùng attempt_number
            },
          },
          {
            // Nhóm lại và tính tổng
            $group: {
              _id: null,
              totalSmoked: { $sum: "$cigarettes_smoked" },
            },
          },
        ]);

        const totalSmokedInAttempt = stats[0]?.totalSmoked || 0;

        // 3. Trả về một object mới bao gồm thông tin cũ và thông tin mới
        return {
          ...stage,
          total_cigarettes_smoked: totalSmokedInAttempt,
        };
      })
    );

    res.status(200).json(stagesWithProgress);
  } catch (error) {
    res.status(400).json({ message: "Error fetching stages", error });
  }
};

// ✅ Get one stage by ID — Owner, Coach, Admin
exports.getStageById = async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id);
    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const access = await canAccessPlan(req.user, stage.plan_id);
    if (!access.allowed) {
      return res
        .status(403)
        .json({ message: access.reason || "Access denied" });
    }

    res.status(200).json(stage);
  } catch (error) {
    res.status(400).json({ message: "Error fetching stage", error });
  }
};

// ✅ Update stage — Coach, Admin
exports.updateStage = async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id);
    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    const access = await canAccessPlan(req.user, stage.plan_id);
    if (!access.allowed || (!access.isCoach && !access.isAdmin)) {
      return res
        .status(403)
        .json({ message: "Only coach or admin can update this stage" });
    }

    const updated = await Stage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (req.body.is_completed === true) {
      const stages = await Stage.find({ plan_id: stage.plan_id });

      const allCompleted = stages.every((s) => s.is_completed === true);

      if (allCompleted) {
        await QuitPlan.findByIdAndUpdate(stage.plan_id, {
          status: "completed",
        });
      }
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: "Error updating stage", error });
  }
};

// ✅ Delete stage — Admin only
exports.deleteStage = async (req, res) => {
  try {
    const stage = await Stage.findById(req.params.id);
    if (!stage) {
      return res.status(404).json({ message: "Stage not found" });
    }

    // if (req.user.role !== "admin") {
    //   return res.status(403).json({ message: "Only admin can delete stages" });
    // }

    await Stage.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Stage deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: "Error deleting stage", error });
  }
};

// ✅ Get all stages (Admin only)
exports.getAllStages = async (req, res) => {
  try {
    if ((req.user.role !== "admin") & (req.user.role !== "coach")) {
      return res
        .status(403)
        .json({ message: "Only admin can access all stages" });
    }

    const stages = await Stage.find().sort({ createdAt: -1 });
    res.status(200).json(stages);
  } catch (error) {
    res.status(400).json({ message: "Error fetching all stages", error });
  }
};

exports.getStagesByCoach = async (req, res) => {
  try {
    // Lấy danh sách kế hoạch do coach đang đăng nhập tạo
    const myPlans = await QuitPlan.find({ coach_id: req.user.id }).select(
      "_id"
    );

    const planIds = myPlans.map((plan) => plan._id);

    const stages = await Stage.find({ plan_id: { $in: planIds } }).sort({
      stage_number: 1,
    });

    res.status(200).json(stages);
  } catch (error) {
    console.error("Lỗi khi lấy stages của coach:", error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách giai đoạn", error });
  }
};
