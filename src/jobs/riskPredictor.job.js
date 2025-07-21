const cron = require('node-cron');
const axios = require('axios');
const User = require('../models/user.model');
const Notification = require('../models/notificaltion.model');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';
// const AI_SERVICE_URL ='http://127.0.0.1:5001';
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
            console.log(`[Cron Job] Nguy cơ tái nghiện cho user ${user._id}: ${risk}`);

            if (risk > RISK_THRESHOLD) {
                const riskPercentage = Math.round(risk * 100);
                console.log(`[Cron Job] Nguy cơ cao (${riskPercentage}%) cho user ${user._id}. Lấy thêm insight...`);

                let insightMessage = "Hãy chú ý đến các thói quen của bạn nhé."; // Mặc định

                try {                   
                    // Bước 2: Nếu nguy cơ cao, gọi thêm API /insight
                    const insightResponse = await axios.get(`${AI_SERVICE_URL}/insight/${user._id}`);
                    const insights = insightResponse.data.insights; // vd: ["khi uống cà phê", "vào buổi sáng"]

                    if (insights && insights.length > 0) {
                        // Ghép các insight lại thành một câu hoàn chỉnh
                        insightMessage = `AI của chúng tôi nhận thấy bạn thường có nguy cơ cao ${insights.join(" và ")}.`;
                    }                  

                } catch (insightError) {
                    console.error(`[Cron Job] Không lấy được insight cho user ${user._id}:`, insightError.message);
                }

                const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];

                // Bước 3: Xây dựng thông báo cuối cùng, kết hợp cả 3 yếu tố
                const finalMessage = `${insightMessage} Khả năng tái nghiện của bạn lúc này là khoảng ${riskPercentage}%. ${randomMessage}`;

                await Notification.create({
                    user_id: user._id,
                    message: finalMessage,
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