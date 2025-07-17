const MeetSession = require('../models/meetSesstion.model');
const User = require('../models/user.model');
const CoachProfile = require('../models/coachProfile.model');

// 1. User đặt lịch hẹn với coach
module.exports.bookSession = async (req, res) => {
    try {
        const { coach_id, schedule_at, purpose } = req.body;
        const user_id = req.user.id; // req.user từ middleware auth

        const coach = await User.findById(coach_id);
        if (!coach || coach.role !== 'coach') {
            return res.status(404).json({ message: 'Coach not found' });
        }

        const session = new MeetSession({ user_id, coach_id, schedule_at, purpose });
        await session.save();
        res.status(201).json(session);
    } catch (err) {
        res.status(500).json({ message: 'Error booking session', error: err.message });
    }
};

// 2. Coach xem danh sách buổi hẹn với mình
module.exports.getCoachSessions = async (req, res) => {
    try {
        const coach_id = req.user.id;

        const sessions = await MeetSession.find({ coach_id }).populate('user_id', 'name email');
        res.status(200).json(sessions);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching coach sessions', error: err.message });
    }
};

// 3. User xem lịch sử/lịch hẹn với coach
module.exports.getUserSessions = async (req, res) => {
    try {
        const user_id = req.user.id;

        const sessions = await MeetSession.find({ user_id }).populate('coach_id', 'name email');
        res.status(200).json(sessions);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user sessions', error: err.message });
    }
};

// 4. Coach cập nhật trạng thái buổi hẹn (xác nhận, từ chối, hoàn tất)
module.exports.updateSessionStatus = async (req, res) => {
    try {
        const sessionId  = req.params.id;
        const { status, meet_link } = req.body;
        const coach_id = req.user.id;

        const session = await MeetSession.findOne({ _id: sessionId, coach_id });
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        if (!['accepted', 'rejected', 'completed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        // Kiểm tra nếu status được cập nhật thành 'completed'
        if (status === 'completed' && session.status !== 'completed') {
            // Tìm và cập nhật coach profile
            const coachProfile = await CoachProfile.findOne({ coach_id });
            if (coachProfile) {
                coachProfile.total_sessions = (coachProfile.total_sessions || 0) + 1;
                await coachProfile.save();
            }
        }
        
        session.status = status;

        if (meet_link) session.meet_link = meet_link;

        await session.save();
        res.status(200).json(session);
    } catch (err) {
        res.status(500).json({ message: 'Error updating session', error: err.message });
    }
  };