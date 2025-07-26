const SmokingStatus = require('../models/smokingStatus.model');
const User = require('../models/user.model');
const QuitPlan = require('../models/quitPlan.model');

module.exports.createSmokingStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        } else {
            const { frequency, cigarettes_per_day, cost_per_pack, start_date } = req.body;
            const newSmokingStatus = new SmokingStatus({
                frequency,
                cigarettes_per_day,
                cost_per_pack, start_date,
                user_id: userId
            });
            await newSmokingStatus.save();
            res.status(200).json({ message: 'Smoking status created successfully' });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message });
    }
};

module.exports.getStatusBysUserId = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const smokingStatus = await SmokingStatus.findOne({ user_id: userId });
       
        res.status(200).json({ message: 'Smoking status found', smokingStatus });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message });
    }
};

module.exports.updateSmokingStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const { frequency, cigarettes_per_day, cost_per_pack, start_date } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const updatedSmokingStatus = await SmokingStatus.findOneAndUpdate(
            { user_id: userId },
            {
                frequency,
                cigarettes_per_day,
                cost_per_pack, start_date,
            },
            { new: true }
        );
        if (!updatedSmokingStatus) {
            return res.status(404).json({ message: 'Smoking status not found' });
        }
        res.status(200).json({ message: 'Smoking status updated successfully', updatedSmokingStatus });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message });
    }
};

//delete smoking status
module.exports.deleteSmokingStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const deletedSmokingStatus = await SmokingStatus.findOneAndDelete({ user_id: userId });
        if (!deletedSmokingStatus) {
            return res.status(404).json({ message: 'Smoking status not found' });
        }
        res.status(200).json({ message: 'Smoking status deleted successfully', deletedSmokingStatus });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message });
    }
};

exports.getStudentSmokingStatusByCoach = async (req, res) => {
    try {
        const coachId = req.user.id; // ID của coach lấy từ token
        const studentId = req.params.studentId; // ID của học viên cần xem

        // 1. Kiểm tra xem có tồn tại một kế hoạch mà coach này đang phụ trách cho học viên này không
        const plan = await QuitPlan.findOne({
            coach_id: coachId,
            user_id: studentId
        });

        if (!plan) {
            return res.status(403).json({ message: "Bạn không có quyền xem thông tin của học viên này." });
        }

        // 2. Nếu có quyền, lấy thông tin tình trạng hút thuốc gần nhất của học viên
        const smokingStatus = await SmokingStatus.findOne({ user_id: studentId }).sort({ createdAt: -1 });

        if (!smokingStatus) {
            return res.status(404).json({ message: "Không tìm thấy thông tin tình trạng hút thuốc của học viên này." });
        }

        res.status(200).json(smokingStatus);

    } catch (error) {
        console.error("Lỗi khi coach lấy tình trạng hút thuốc của học viên:", error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};
