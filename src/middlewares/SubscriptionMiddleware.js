const User = require('../models/user.model');
const checkSubscriptionAccess = (allowedTypes) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.membership) {
            return res.status(401).json({ message: 'Unauthorized: No user found.' });
        }
        const membership = await User.findById(req.user.id)
            .populate('membership');
        const { subscriptionType, expiresAt } = membership.membership;
        console.log(subscriptionType, expiresAt)
        // Kiểm tra loại gói và thời hạn
        if (
            Array.isArray(allowedTypes) &&
            allowedTypes.includes(subscriptionType) &&
            expiresAt &&
            new Date(expiresAt) >= new Date()
        ) {
            next(); // Người dùng có quyền truy cập
        } else {
            return res.status(403).json({ message: 'Bạn cần nâng cấp gói hoặc gói của bạn đã hết hạn.' });
        }
    }
}

module.exports = { checkSubscriptionAccess };