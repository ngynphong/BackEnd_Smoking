const cron = require('node-cron');
const Stage = require('../models/stage.model');
const Task = require('../models/task.model');
const TaskResult = require('../models/TaskResult.model');
const QuitPlan = require('../models/quitPlan.model');
const Notification = require('../models/notificaltion.model');

/**
 * Job này chạy hàng ngày để kiểm tra và tự động hoàn thành các giai đoạn
 * đã thỏa mãn cả hai điều kiện: hết hạn và làm xong hết task.
 */
const stageCompletionJob = async () => {
    console.log('[Stage Completion Job] Bắt đầu quét các giai đoạn...');
    const today = new Date();

    try {
        // 1. Tìm tất cả các giai đoạn chưa hoàn thành và đã đến hạn
        const pendingStages = await Stage.find({
            is_completed: false,
            end_date: { $lt: today } // Chỉ lấy các giai đoạn có ngày kết thúc đã qua
        }).populate('plan_id');

        if (pendingStages.length === 0) {
            console.log('[Stage Completion Job] Không có giai đoạn nào đến hạn cần kiểm tra. Kết thúc.');
            return;
        }

        console.log(`[Stage Completion Job] Tìm thấy ${pendingStages.length} giai đoạn đến hạn cần kiểm tra.`);

        for (const stage of pendingStages) {
            const plan = stage.plan_id;
            if (!plan) continue;

            // 2. Với mỗi giai đoạn, kiểm tra xem tất cả task đã được hoàn thành chưa
            const totalTasks = await Task.countDocuments({ stage_id: stage._id });
            console.log(totalTasks)
            const completedTasks = await TaskResult.countDocuments({
                stage_id: stage._id,
                user_id: plan.user_id,
                attempt_number: stage.attempt_number,
                is_completed: true
            });
            console.log('Completed task',completedTasks)
            const allTasksDone = totalTasks > 0 && totalTasks === completedTasks;

            // 3. Nếu tất cả task đã xong, cập nhật trạng thái giai đoạn
            if (allTasksDone) {
                await Stage.findByIdAndUpdate(stage._id, { is_completed: true });
                console.log(`[Stage Completion Job] Giai đoạn "${stage.title}" của user ${plan.user_id} đã được tự động hoàn thành.`);

                // Gửi thông báo chúc mừng cho người dùng
                await Notification.create({
                    user_id: plan.user_id,
                    message: `Chúc mừng! Bạn đã hoàn thành xuất sắc giai đoạn "${stage.title}". Hãy tiếp tục cố gắng ở giai đoạn tiếp theo nhé!`,
                    type: 'stage_completed'
                });
            }
        }
    } catch (error) {
        console.error('[Stage Completion Job] Gặp lỗi:', error);
    }
};

const startStageCompletionJob = () => {
    // Chạy job vào 00:05 (5 phút sau nửa đêm) mỗi ngày
    cron.schedule('5 0 * * *', () => {
        console.log('[Stage Completion Job] Triggering scheduled job...');
        stageCompletionJob(); // Gọi hàm async của bạn ở đây
    }, {
        timezone: "Asia/Ho_Chi_Minh"
    });
    console.log('✅ Cron job kiểm tra hoàn thành giai đoạn đã được lên lịch chạy mỗi ngày.');
};

module.exports = { startStageCompletionJob };