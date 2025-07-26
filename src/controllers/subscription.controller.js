const Subscription = require("../models/subscription.model");
const Package = require("../models/package.model");

// [1] Create subscription
exports.createSubscription = async (req, res) => {
  try {
    const { package_id } = req.body; // Lấy package_id từ body (người dùng chọn gói)
    const userId = req.user.id; // Lấy user_id từ middleware auth

    if (!package_id) {
      return res.status(400).json({ message: "ID gói là bắt buộc." });
    }

    // 1. Tìm thông tin gói từ Package model
    const packageInfo = await Package.findById(package_id);
    if (!packageInfo) {
      return res.status(404).json({ message: "Không tìm thấy gói này." });
    }

    // Kiểm tra xem người dùng có gói cao cấp đang hoạt động không
    const existingActiveSubscription = await Subscription.findOne({
      user_id: userId,
      status: 'active',
      name: { $ne: 'free' }, // Không phải gói free
      end_date: { $gte: new Date() } // Và còn hạn
    });

    if (existingActiveSubscription) {
      return res.status(400).json({
        message: "Bạn đã có gói đăng ký cao cấp đang hoạt động."
      });
    }

    // Tìm gói đăng ký hiện tại của người dùng (có thể là 'free' hoặc hết hạn)
    let userSubscription = await Subscription.findOne({ user_id: userId });

    if (userSubscription) {
      // Cập nhật gói đăng ký hiện có
      userSubscription.package_id = packageInfo._id;
      userSubscription.name = packageInfo.name;
      userSubscription.price = packageInfo.price;
      userSubscription.status = "pending";
      // start_date và end_date sẽ được cập nhật sau khi thanh toán thành công
      const savedSubscription = await userSubscription.save();
      res.status(200).json({
        message: "Gói đăng ký đã được cập nhật, đang chờ thanh toán.",
        subscription: savedSubscription,
      });
    } else {
      // Trường hợp người dùng chưa có bản ghi subscription nào (fallback)
      const newSubscription = new Subscription({
        user_id: userId,
        package_id: packageInfo._id,
        name: packageInfo.name,
        price: packageInfo.price,
        status: "pending",
      });
      const savedSubscription = await newSubscription.save();
      res.status(201).json({
        message: "Yêu cầu đăng ký gói đã được tạo thành công, đang chờ thanh toán.",
        subscription: savedSubscription,
      });
    }
  } catch (err) {
    console.error("Lỗi khi tạo Subscription:", err);
    res.status(500).json({ message: "Lỗi máy chủ nội bộ.", error: err.message });
  }
};

// [2] Get all subscriptions (admin/coach)
exports.getAllSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find();

    res.status(200).json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [3] Get subscription by ID
exports.getSubscriptionById = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id);

    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    res.status(200).json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// [4] Update subscription
exports.updateSubscription = async (req, res) => {
  try {
    const updated = await Subscription.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ error: "Subscription not found" });
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// [5] Delete subscription
exports.deleteSubscription = async (req, res) => {
  try {
    const deleted = await Subscription.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Subscription not found" });
    res.status(200).json({ message: "Subscription deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.MyActiveSubscription = async (req, res) => {
  try{
    const subs = await Subscription.find({user_id: req.user.id, status: "active"}).populate('package_id');
    res.status(200).json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}