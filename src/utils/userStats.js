const Progress = require('../models/progress.model');
const UserBadge = require('../models/userBadge.model');

const getUserProgressStats = async (user_id) => {
    const progresses = await Progress.find({ user_id }).sort({ date: 1 });

    let total_days_no_smoke = 0;
    let total_money_saved = 0;
    let days_since_start = 0;

    let lastDate = null;
    let firstDate = null;

    let currentStreak = 0;
    let maxStreak = 0;

    progresses.forEach((p, idx) => {
        const currDate = new Date(p.date).setHours(0, 0, 0, 0);

        if (idx === 0) firstDate = currDate;

        if (p.cigarettes_smoked === 0) {
            total_days_no_smoke++;

            if (lastDate !== null) {
                const prevDate = new Date(lastDate).setHours(0, 0, 0, 0);
                const diff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

                currentStreak = (diff === 1) ? currentStreak + 1 : 1;
            } else {
                currentStreak = 1;
            }

            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }

        lastDate = currDate;
        total_money_saved += p.money_saved;
    });

    // Đếm tổng số huy hiệu người dùng đã có
    const total_badges_earned = await UserBadge.countDocuments({ user_id });

    if (firstDate) {
        const today = new Date().setHours(0, 0, 0, 0);
        days_since_start = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24)) + 1;
    }

    return {
        total_days_no_smoke,
        total_money_saved,
        days_since_start,
        consecutive_no_smoke_days: maxStreak,
        total_badges_earned
    };
};

module.exports = getUserProgressStats;