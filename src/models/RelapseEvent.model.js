const mongoose = require('mongoose');
const { Schema } = mongoose;

const relapseEventSchema = new Schema({
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // Dữ liệu từ người dùng
    cigarettes_smoked: { type: Number, required: true, min: 1, default: 1 },
    activity: {
        type: String,
        enum: ['drinking_coffee', 'after_meal', 'stressful_work', 'socializing', 'bored', 'driving', 'other'],
        required: true
    },
    emotion: {
        type: String,
        enum: ['stressed', 'bored', 'happy', 'sad', 'anxious', 'other'],
        required: true
    },
}, { timestamps: true }); // `timestamps: true` sẽ tự động tạo `createdAt` và `updatedAt`

const RelapseEvent = mongoose.model('RelapseEvent', relapseEventSchema);
module.exports = RelapseEvent;