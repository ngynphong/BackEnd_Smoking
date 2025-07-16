const cron = require('node-cron');
const axios = require('axios');
const User = require('../models/user.model');
const Notification = require('../models/notificaltion.model');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';
const RISK_THRESHOLD = 0.7; // Ngưỡng nguy cơ

const motivationMessages = [
    // Nhấn mạnh vào lợi ích sức khỏe
    "Hít một hơi thật sâu và cảm nhận lá phổi của bạn đang dần hồi phục. Bạn đang làm rất tốt!",
    "Mỗi giây phút bạn không hút thuốc, cơ thể bạn đang tự chữa lành. Hãy tiếp tục nhé!",
    "Hãy nhớ lại cảm giác khỏe khoắn và tràn đầy năng lượng mà bạn đang hướng tới. Đừng từ bỏ!",
    "Bạn đang cho trái tim mình một cơ hội để khỏe mạnh hơn mỗi ngày. Thật đáng tự hào!",

    // Nhấn mạnh vào sự mạnh mẽ và ý chí
    "Cơn thèm thuốc chỉ là tạm thời, nhưng sự mạnh mẽ của bạn là mãi mãi. Bạn sẽ vượt qua được!",
    "Bạn đã đi được một chặng đường dài rồi. Đừng để một phút yếu lòng phá hỏng tất cả nỗ lực.",
    "Chứng minh cho chính mình thấy bạn làm chủ được cuộc sống của mình, không phải điếu thuốc.",
    "Bạn mạnh mẽ hơn bạn nghĩ rất nhiều. Hãy tin vào bản thân!",

    // Gợi ý hành động thay thế
    "Cảm giác này sẽ qua nhanh thôi! Hãy thử uống một ly nước mát hoặc ăn một miếng trái cây xem sao.",
    "Đánh lạc hướng nào! Mở một bản nhạc bạn yêu thích hoặc xem một video hài hước.",
    "Hãy đi bộ nhanh 5 phút. Vận động một chút sẽ giúp xua tan cơn thèm hiệu quả.",
    "Nhai một viên kẹo cao su không đường có thể là một 'cứu cánh' tuyệt vời ngay lúc này.",

    // Nhắc nhở về lý do và thành quả
    "Hãy nghĩ về lý do bạn bắt đầu hành trình này. Nó xứng đáng với nỗ lực của bạn.",
    "Bạn đã tiết kiệm được một khoản tiền đáng kể rồi đấy. Hãy nghĩ xem bạn sẽ dùng nó vào việc gì ý nghĩa nhé!",
    "Mỗi ngày không khói thuốc là một món quà bạn dành cho chính mình và những người thân yêu."
];

const job = async () => {
    console.log('[Cron Job] Bắt đầu quét nguy cơ tái nghiện...');

    const activeUsers = await User.find({
        'membership.subscriptionType': { $in: ['plus', 'premium'] },
        'membership.expiresAt': { $gte: new Date() }
    });

    for (const user of activeUsers) {
        try {
            const response = await axios.post(`${AI_SERVICE_URL}/predict`, {
                user_id: user._id
            });

            const risk = response.data.risk_score;

            if (risk > RISK_THRESHOLD) {
                // Chuyển đổi điểm số nguy cơ thành phần trăm
                const riskPercentage = Math.round(risk * 100);

                // Log thông tin chi tiết hơn
                console.log(`[Cron Job] Nguy cơ cao (${riskPercentage}%) cho user ${user._id}. Gửi thông báo.`);

                // Chọn ngẫu nhiên một thông điệp
                const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];

                // Tạo thông báo mới, bao gồm cả phần trăm nguy cơ
                const finalMessage = `AI dự báo khả năng bạn tái nghiện của bạn lúc này là khoảng ${riskPercentage}%. ${randomMessage}`;

                // Tạo thông báo trong DB
                await Notification.create({
                    user_id: user._id,
                    message: finalMessage, // Sử dụng thông báo đã được cá nhân hóa
                    type: 'ai_intervention'
                });
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log(`[Cron Job] Bỏ qua user ${user._id}: Chưa có mô hình để dự báo.`);
            } else {
                console.error(`[Cron Job] Lỗi khi xử lý cho user ${user._id}:`, error.message);
            }
        }
    }
    console.log('[Cron Job] Quét xong.');
};

const startPredictionJob = () => {
    cron.schedule('*/30 * * * *', job);
    console.log('Cron job dự báo nguy cơ tái nghiện đã được lên lịch chạy mỗi 30 phút.');
};

module.exports = { startPredictionJob };