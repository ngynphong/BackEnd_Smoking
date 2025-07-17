const Badge = require('../models/badge.model');
const UserBadge = require('../models/userBadge.model');
const User = require('../models/user.model');
const getUserProgressStats = require('../utils/userStats');

// Tạo badge
module.exports.createBadge = async (req, res) => {
    try {
        const { name, condition, tier, point_value, url_image } = req.body;

        const badge = new Badge({ name, condition, tier, point_value, url_image });
        await badge.save();

        res.status(201).json(badge);
    } catch (error) {
        res.status(500).json({ message: 'Error creating badge', error: error.message });
    }
};

// Lấy danh sách badge
module.exports.getAllBadges = async (req, res) => {
    try {
        const badges = await Badge.find();
        res.status(200).json(badges);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching badges', error: error.message });
    }
};

//Update badge
module.exports.updateBadge = async (req, res) => {
    try {
        const badgeId = req.params.id;
        const { name, condition, tier, point_value, url_image } = req.body;
        const badge = await Badge.findByIdAndUpdate(badgeId, { name, condition, tier, point_value, url_image }, { new: true });
        if (!badge) {
            return res.status(404).json({ message: 'Badge not found' });
        }
        return res.status(200).json({ message: 'Badge updated successfully', badge });

    } catch (error) {
        res.status(500).json({ message: 'Error update badge', error: error.message });
    }
};

//Delete badge
module.exports.deleteBadge = async (req, res) => {
    try {
        const badgeId = req.params.id;
        const badge = await Badge.findByIdAndDelete(badgeId);

        if (!badge) {
            return res.status(404).json({ message: 'Badge not found' })
        }
        return res.status(200).json({ message: 'Badge deleted successfully', badge })

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: 'Error delete badge', error: error.message })
    }
};


// GET /api/badges/user/:userId
module.exports.getAllBadgesWithUserStatus = async (req, res) => {
    const userId = req.params.id;

    try {
        const allBadges = await Badge.find();
        const userBadges = await UserBadge.find({ user_id: userId });

        // Tạo map các badge đã đạt
        const earnedBadgeMap = userBadges.reduce((ern, ub) => {
            ern[ub.badge_id.toString()] = true;
            return ern;
        }, {});

        // Trộn badge + trạng thái
        const result = allBadges.map(badge => ({
            ...badge.toObject(),
            earned: !!earnedBadgeMap[badge._id.toString()],
        }));

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports.getBadgeLeaderBoard = async (req, res) => {
    // Lấy 'type' từ query, mặc định là 'points' nếu không được cung cấp
    const { type = 'points' } = req.query;
    const limit = parseInt(req.query.limit) || 10; // Giới hạn số lượng, mặc định 10

    let leaderboard = [];

    try {
        console.log(`[Leaderboard] Bắt đầu tạo bảng xếp hạng loại: ${type}`);

        switch (type) {
            case 'no_smoke_days':
                const usersForSmokeDays = await User.find({ role: 'user' }, 'name avatar_url');
                let smokeDaysLeaderboard = [];
                for (const user of usersForSmokeDays) {
                    const stats = await getUserProgressStats(user._id);
                    smokeDaysLeaderboard.push({
                        user: user,
                        score: stats.consecutive_no_smoke_days || 0
                    });
                }
                leaderboard = smokeDaysLeaderboard.sort((a, b) => b.score - a.score).slice(0, limit);
                break;

            case 'money_saved':
                const usersForMoney = await User.find({ role: 'user' }, 'name avatar_url');
                let moneyLeaderboard = [];
                for (const user of usersForMoney) {
                    const stats = await getUserProgressStats(user._id);
                    moneyLeaderboard.push({
                        user: user,
                        score: Math.round(stats.total_money_saved) || 0
                    });
                }
                leaderboard = moneyLeaderboard.sort((a, b) => b.score - a.score).slice(0, limit);
                break;

            case 'badge_count':
                leaderboard = await UserBadge.aggregate([
                    { $group: { _id: "$user_id", score: { $sum: 1 } } },
                    { $sort: { score: -1 } },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: "users",
                            localField: "_id",
                            foreignField: "_id",
                            as: "user"
                        }
                    },
                    { $unwind: "$user" },
                    {
                        $project: {
                            _id: 0,
                            score: 1,
                            "user._id": "$user._id",
                            "user.name": "$user.name",
                            "user.avatar_url": "$user.avatar_url"
                        }
                    }
                ]);
                break;

            // Case 'points' hoặc trường hợp mặc định sẽ chạy logic cũ của bạn
            case 'points':
            default:
                leaderboard = await UserBadge.aggregate([
                    // Join với collection 'badges' để lấy point_value
                    {
                        $lookup: {
                            from: "badges",
                            localField: "badge_id",
                            foreignField: "_id",
                            as: "badgeInfo"
                        }
                    },
                    { $unwind: "$badgeInfo" },
                    // Gom nhóm theo user_id và tính tổng điểm
                    {
                        $group: {
                            _id: "$user_id",
                            score: { $sum: "$badgeInfo.point_value" }
                        }
                    },
                    { $sort: { score: -1 } },
                    { $limit: limit },
                    // Join với collection 'users' để lấy thông tin user
                    {
                        $lookup: {
                            from: "users",
                            localField: "_id",
                            foreignField: "_id",
                            as: "user"
                        }
                    },
                    { $unwind: "$user" },
                    {
                        $project: {
                            _id: 0,
                            score: 1,
                            "user._id": "$user._id",
                            "user.name": "$user.name",
                            "user.avatar_url": "$user.avatar_url"
                        }
                    }
                ]);
                break;
        }

        res.status(200).json(leaderboard);

    } catch (error) {
        console.error(`Lỗi khi tạo bảng xếp hạng loại '${type}':`, error);
        res.status(500).json({ message: "Lỗi máy chủ khi tạo bảng xếp hạng", error: error.message });
    }
};

module.exports.getBadgeStats = async (req, res) => {
    try {
        // Lấy tất cả badge
        const badges = await Badge.find();

        // Lấy user đã đạt từng badge (populate user)
        const badgeUsers = await UserBadge.find().populate('user_id', 'name email avatar_url').populate('badge_id', 'name tier');

        // Gom nhóm theo badge
        const badgeMap = {};
        badgeUsers.forEach(ub => {
            // Bỏ qua nếu thiếu user hoặc badge (dữ liệu lỗi)
            if (!ub.user_id || !ub.badge_id) return;

            const badgeId = ub.badge_id._id.toString();
            if (!badgeMap[badgeId]) {
                badgeMap[badgeId] = {
                    badge_id: badgeId,
                    name: ub.badge_id.name,
                    tier: ub.badge_id.tier,
                    users: []
                };
            }
            badgeMap[badgeId].users.push({
                user_id: ub.user_id._id,
                name: ub.user_id.name,
                email: ub.user_id.email,
                avatar_url: ub.user_id.avatar_url,
                date_awarded: ub.date_awarded
            });
        });

        // Đảm bảo trả về cả badge chưa ai đạt
        const result = badges.map(badge => ({
            badge_id: badge._id,
            name: badge.name,
            tier: badge.tier,
            users: badgeMap[badge._id.toString()] ? badgeMap[badge._id.toString()].users : []
        }));

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error getting badge stats', error: error.message });
    }
};

exports.getBadgeProgress = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Lấy tất cả các chỉ số hiện tại của người dùng
        const userStats = await getUserProgressStats(userId);

        // 2. Lấy tất cả huy hiệu có trong hệ thống và huy hiệu người dùng đã có
        const [allBadges, earnedUserBadges] = await Promise.all([
            Badge.find(),
            UserBadge.find({ user_id: userId }).select('badge_id')
        ]);

        // Tạo một Set chứa ID của các huy hiệu đã có để tra cứu nhanh hơn
        const earnedBadgeIds = new Set(earnedUserBadges.map(ub => ub.badge_id.toString()));

        const badgeProgressList = [];

        // Biểu thức chính quy để phân tích chuỗi điều kiện
        const conditionRegex = /(\w+)\s*([>=]+)\s*(\d+)/;

        for (const badge of allBadges) {
            // 3. Bỏ qua nếu huy hiệu đã được nhận
            if (earnedBadgeIds.has(badge._id.toString())) {
                continue;
            }

            const match = badge.condition.match(conditionRegex);

            // 4. Nếu điều kiện của huy hiệu có thể phân tích được
            if (match) {
                const metricName = match[1]; // vd: 'total_money_saved'
                const targetValue = parseInt(match[3], 10); // vd: 100000

                // Lấy giá trị hiện tại của người dùng tương ứng với chỉ số của huy hiệu
                const currentValue = userStats[metricName];

                if (currentValue !== undefined && targetValue > 0) {
                    // 5. Tính toán tiến độ
                    const progressPercent = Math.min(100, Math.floor((currentValue / targetValue) * 100));

                    badgeProgressList.push({
                        badge_id: badge._id,
                        name: badge.name,
                        tier: badge.tier,
                        url_image: badge.url_image,
                        condition: badge.condition,
                        current_value: Math.round(currentValue),
                        target_value: targetValue,
                        progress_percent: progressPercent
                    });
                }
            }
        }

        res.status(200).json(badgeProgressList);

    } catch (error) {
        console.error("Lỗi khi lấy tiến trình huy hiệu:", error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};