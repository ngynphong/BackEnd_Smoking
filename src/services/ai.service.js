// src/services/ai.service.js
const axios = require('axios');

// Địa chỉ của AI service, bạn có thể đặt trong file .env
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

/**
 * Gửi yêu cầu huấn luyện mô hình cho một user cụ thể đến Python AI service.
 * Đây là một lệnh "fire-and-forget", không cần chờ kết quả.
 * @param {string} userId - ID của người dùng cần huấn luyện.
 */
const triggerTrainingForUser = (userId) => {
    if (!userId) {
        console.error('[Node AI Service] Lỗi: Thiếu userId khi gọi huấn luyện.');
        return;
    }

    console.log(`[Node AI Service] Gửi yêu cầu huấn luyện cho user ${userId} đến Python service.`);

    axios.post(`${AI_SERVICE_URL}/train`, { user_id: userId })
        .then(response => {
            console.log(`[Node AI Service] Python service đã chấp nhận yêu cầu huấn luyện cho user ${userId}.`);
        })
        .catch(error => {
            console.error(`[Node AI Service] Lỗi khi gửi yêu cầu huấn luyện cho user ${userId}:`, error.message);
        });
};

module.exports = { triggerTrainingForUser };