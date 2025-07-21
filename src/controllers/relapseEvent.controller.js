const RelapseEvent = require('../models/RelapseEvent.model');
const { triggerTrainingForUser } = require('../services/ai.service');

exports.createRelapseEvent = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { cigarettes_smoked, activity, emotion } = req.body;

        // Kiểm tra dữ liệu đầu vào
        if (!cigarettes_smoked || !activity || !emotion) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin: cigarettes_smoked, activity, và emotion.' });
        }

        const newEvent = new RelapseEvent({
            user_id,
            cigarettes_smoked,
            activity,
            emotion
        });

        await newEvent.save();

        // 🔥 Quan trọng: Trigger việc huấn luyện lại mô hình AI với dữ liệu mới
        triggerTrainingForUser(user_id);

        res.status(201).json({ message: 'Ghi nhận sự kiện thành công!', event: newEvent });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ khi ghi nhận sự kiện', error: error.message });
    }
};