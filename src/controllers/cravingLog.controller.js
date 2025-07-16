const CravingLog = require('../models/cravingLog.model');
const { triggerTrainingForUser } = require('../services/ai.service');

exports.createCravingLog = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { activity, emotion, craving_intensity } = req.body;

        const newLog = new CravingLog({
            user_id,
            activity,
            emotion,
            craving_intensity
        });

        await newLog.save();

        // 🔥 Quan trọng: Sau khi lưu log mới, gọi huấn luyện lại mô hình cho user này
        // Chạy bất đồng bộ để không block response trả về cho người dùng
        triggerTrainingForUser(user_id);

        res.status(201).json({ message: 'Ghi nhận cơn thèm thành công!', log: newLog });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
};