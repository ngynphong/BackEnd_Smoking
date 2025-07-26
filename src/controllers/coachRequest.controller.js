const CoachRequest = require("../models/coachRequest.model");
const User = require("../models/user.model");
const QuitPlan = require("../models/quitPlan.model");

// ✅ Gửi yêu cầu mời user trở thành coach
exports.sendCoachInvite = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user || user.role !== "user") {
      return res
        .status(404)
        .json({ message: "User không tồn tại hoặc không hợp lệ" });
    }

    // Kiểm tra user có hoàn thành kế hoạch chưa
    const completedPlan = await QuitPlan.findOne({
      user_id: userId,
      status: "completed",
    });

    if (!completedPlan) {
      return res
        .status(400)
        .json({ message: "Người dùng chưa hoàn thành kế hoạch cai thuốc" });
    }

    // Kiểm tra đã gửi trước đó chưa
    const existed = await CoachRequest.findOne({
      user_id: userId,
      status: "pending",
    });

    if (existed) {
      return res.status(400).json({ message: "Đã gửi lời mời rồi" });
    }

    const request = await CoachRequest.create({
      user_id: userId,
      sent_by: req.user.id,
    });

    res.status(201).json({ message: "Đã gửi lời mời", request });
  } catch (error) {
    console.error("Error sending coach invite:", error); // 👈 Thêm dòng này
    res.status(400).json({
      message: "Lỗi khi gửi lời mời",
      error: error.message,
      stack: error.stack,
    });
  }
};
// ✅ User chấp nhận lời mời trở thành coach
exports.respondToInvite = async (req, res) => {
  try {
    const { requestId } = req.params; // action: "accept" | "reject"

    const { action } = req.body;

    const request = await CoachRequest.findById(requestId);
    if (!request || request.user_id.toString() !== req.user.id) {
      return res.status(403).json({ message: "Không được phép" });
    }

    if (action === "accept") {
      await User.findByIdAndUpdate(req.user.id, { role: "coach" });
      request.status = "accepted";
    } else {
      request.status = "rejected";
    }

    await request.save();
    res.status(200).json({
      message: `Đã ${action === "accept" ? "chấp nhận" : "từ chối"} lời mời`,
    });
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi xử lý lời mời", error });
  }
};
// ✅ Xem danh sách lời mời đã gửi
exports.getAllCoachRequests = async (req, res) => {
  try {
    const requests = await CoachRequest.find()
      .populate("user_id", "name email")
      .populate("sent_by", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi lấy danh sách lời mời", error });
  }
};
