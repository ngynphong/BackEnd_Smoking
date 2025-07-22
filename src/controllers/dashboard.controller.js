const User = require('../models/user.model');
const QuitPlan = require('../models/quitPlan.model');
const Payment = require('../models/payment.model');
const Feedback = require('../models/feedback.model');
const Subscription = require('../models/subscription.model');

exports.getDashboardStatistics = async (req, res) => {
    try {
        // Sử dụng Promise.all để chạy tất cả các truy vấn song song, tăng hiệu suất
        const [
            totalUsers,
            activePlans,
            totalRevenue,
            totalFeedbacks,
            userGrowth,
            revenueOverview,
            subscriptionDistribution,
            feedbackTypes
        ] = await Promise.all([
            // 1. KPI: Total Users
            User.countDocuments({ role: 'user' }),

            // 2. KPI: Active Plans (Kế hoạch có ngày kết thúc trong tương lai)
            QuitPlan.countDocuments({ target_quit_date: { $gte: new Date() } }),

            // 3. KPI: Total Revenue
            Payment.aggregate([
                { $match: { status: 'PAID' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),

            // 4. KPI: Total Feedbacks
            Feedback.countDocuments(),

            // 5. Chart: User Growth (tổng hợp user mới theo tháng trong 6 tháng gần nhất)
            User.aggregate([
                {
                    $match: {
                        role: 'user',
                        createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
                { $project: { _id: 0, month: "$_id.month", year: "$_id.year", count: 1 } }
            ]),

            // 6. Chart: Revenue Overview (tổng hợp doanh thu theo tháng)
            Payment.aggregate([
                {
                    $match: {
                        status: 'PAID',
                        payment_date: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
                    }
                },
                {
                    $group: {
                        _id: { year: { $year: "$payment_date" }, month: { $month: "$payment_date" } },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } },
                { $project: { _id: 0, month: "$_id.month", year: "$_id.year", total: 1 } }
            ]),

            // 7. Chart: Active Subscription Distribution
            // Lưu ý: Giao diện của bạn ghi là "Active Plan", nhưng logic hợp lý hơn là phân phối các gói "Subscription" đang active.
            Subscription.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$name', count: { $sum: 1 } } },
                { $project: { _id: 0, name: "$_id", count: 1 } }
            ]),

            // 8. Chart: Feedback Types
            Feedback.aggregate([
                { $group: { _id: '$feedback_type', count: { $sum: 1 } } },
                { $project: { _id: 0, name: "$_id", count: 1 } }
            ])
        ]);

        // Định dạng lại kết quả cuối cùng để trả về cho client
        const response = {
            kpi: {
                totalUsers,
                activePlans,
                totalRevenue: totalRevenue[0]?.total || 0,
                totalFeedbacks
            },
            charts: {
                userGrowth,
                revenueOverview,
                subscriptionDistribution,
                feedbackTypes
            }
        };

        res.status(200).json(response);

    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu dashboard:", error);
        res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
};