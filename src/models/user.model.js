const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId; // Password is required only if googleId is not present
        },
        minlength: 6,
    },
    name: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'coach'],
        default: 'user',
    },
    avatar_url: {
        type: String,
    },
    vertificationToken: {
        type: String,
        default: null,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    ressetPasswordToken: {
        type: String,
        default: undefined,
    },
    ressetPasswordExpires: {
        type: Date,
        default: undefined,
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },
    otp: {
        type: String,
        default: null,
    },
    otpExpires: {
        type: Date,
        default: null,
    },
    membership: {
        subscriptionType: {
            type: String,
            // enum: ['free', 'plus', 'premium'],
            default: 'free',
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    }
},
{ timestamps: true,});
// Hash the password before saving the user
userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});
// Compare the password with the hashed password
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.isValidPassword = async function (password) {
    if (!this.password) {
        return false; // Google users won't have a password
    }
    return await bcrypt.compare(password, this.password);
};


const User = mongoose.model('User', userSchema);

module.exports = User;
