const mongoose = require('mongoose');
const { Schema } = mongoose;

const cravingLogSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Thêm các trường ngữ cảnh mà bạn muốn thu thập từ người dùng
    activity: { type: String, enum: ['drinking_coffee', 'after_meal', 'stressful_work', 'socializing', 'bored', 'other'] },
    emotion: { type: String, enum: ['stressed', 'bored', 'happy', 'sad', 'anxious', 'other'] },
    craving_intensity: { type: Number, min: 1, max: 10 }, // Mức độ thèm từ 1-10
}, { timestamps: true });

const CravingLog = mongoose.model('CravingLog', cravingLogSchema);
module.exports = CravingLog;