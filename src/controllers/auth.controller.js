const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config();
const crypto = require('crypto');
const transporter = require('../configs/emailConfig');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Subscription = require('../models/subscription.model');
const Package = require('../models/package.model');
//Create token
const maxAge = 3 * 24 * 60 * 60;
const createToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
            name: user.name,
            avatar_url: user.avatar_url,
            membership: user.membership
        },
        process.env.JWT_SECRET,
        {
            expiresIn: maxAge
        }
    );
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Register a new user
module.exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existUser = await User.findOne({ email })
        if (existUser) {
            return res.status(400).json({ message: 'Email đăng ký đã tồn tại' });
        }
        //Token xác thực
        const vertificationToken = crypto.randomBytes(32).toString('hex');
        const avatar_url = `https://ui-avatars.com/api/?name=${name}&background=random`

        const newuser = new User({
            name,
            email,
            password,
            avatar_url,
            vertificationToken,
            membership: 'free'
        });

        await newuser.save();

        // Tìm gói free trong Package collection
        const freePackage = await Package.findOne({ name: 'free' });
        if (!freePackage) {
            throw new Error('Free package not found');
        }

        // Tạo subscription mới cho user với gói free
        const newSubscription = new Subscription({
            user_id: newuser._id,
            package_id: freePackage._id,
            name: freePackage.name,
            price: freePackage.price,
            start_date: new Date(),
            end_date: null, // Gói free thường không có ngày hết hạn
            status: 'active'
        });

        await newSubscription.save();

        // Tạo link xác thực
        const verificationLink = `http://localhost:${process.env.VITE_PORT}/login/${vertificationToken}`;// sẽ sửa lại verificationLink khi có front-end fogetpassword
        // Gửi email xác thực
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Xác thực tài khoản',
            html: `
                <!DOCTYPE html>
                <html>
                    <body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: Arial, sans-serif;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                            <h2 style="color: #2C3E50; text-align: center; margin-bottom: 20px; font-size: 24px;">Xin chào ${name}!</h2>
                            <div style="color: #666; line-height: 1.6; font-size: 16px;">
                                <p style="margin-bottom: 15px;">Cảm ơn bạn đã đăng ký tài khoản. Vui lòng click vào nút bên dưới để xác thực tài khoản của bạn:</p>
                                <div style="text-align: center; margin: 25px 0;">
                                    <a href="${verificationLink}" 
                                    style="background-color: #3498DB; 
                                            color: white; 
                                            padding: 12px 30px; 
                                            text-decoration: none; 
                                            border-radius: 5px; 
                                            font-weight: bold;
                                            display: inline-block;">
                                        Xác thực tài khoản
                                    </a>
                                </div>
                                <p style="color: #999; font-size: 14px; text-align: center; margin-top: 20px;">Link này sẽ hết hạn sau 24 giờ.</p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                <p style="color: #999; font-size: 12px; text-align: center;">Nếu bạn không yêu cầu xác thực này, vui lòng bỏ qua email này.</p>
                            </div>
                        </div>
                    </body>
                </html>
            `
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ message: 'Lỗi khi gửi email' });
            }
            console.log('Email sent:', info.response);
        })

        return res.status(201).json({
            message: 'User created successfully, please check your email to verify your email account',
            subscription: {
                name: freePackage.name,
                status: 'active'
            }
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
//Verify email
module.exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ vertificationToken: token });
        if (!user) {
            return res.status(400).json({ message: 'Invalid token' });
        }
        user.isVerified = true;
        user.vertificationToken = null;
        await user.save();

        return res.status(200).json({
            message: 'Email verified successfully'
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Register send OTP
module.exports.registerSendOtp = async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered' });

        const otp = generateOtp();
        const newUser = new User({ email, password, name, otp, otpExpires: Date.now() + 10 * 60 * 1000 });
        await newUser.save();

        // Send OTP email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your verification code',
            html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: Arial, sans-serif;">
                        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #1a73e8; font-size: 28px; margin: 0; padding: 0;">Verification Required</h1>
                                <p style="color: #5f6368; font-size: 16px; margin-top: 10px;">Please use the code below to verify your account</p>
                            </div>
                            
                            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center; margin: 20px 0;">
                                <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a73e8; font-family: monospace;">
                                    ${otp}
                                </div>
                            </div>

                            <div style="text-align: center; margin-top: 30px;">
                                <p style="color: #5f6368; font-size: 14px; margin: 0;">This code will expire in 10 minutes</p>
                                <p style="color: #5f6368; font-size: 14px; margin-top: 20px;">If you didn't request this code, you can safely ignore this email.</p>
                            </div>

                            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                                <p style="color: #5f6368; font-size: 12px; margin: 0;">
                                    This is an automated email, please do not reply.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
        });

        res.status(200).json({ message: 'Registered. Please verify email with the code sent.' });
    } catch (err) {
        res.status(500).json({ message: 'Error registering', error: err });
    }
};

module.exports.verifyEmailWithOtp = async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.isVerified) return res.status(400).json({ message: 'User already verified' });

        if (user.otp !== code || Date.now() > user.otpExpires) {
            return res.status(400).json({ message: 'Invalid or expired code' });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Verification failed', error: err });
    }
};


// Login a user
module.exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
        }

        // Kiểm tra xác thực email
        if (!user.isVerified) {
            return res.status(400).json({
                message: 'Email not verified',
                verificationLink: `http://localhost:${process.env.VITE_PORT}/login/${user.vertificationToken}`// sẽ sửa lại verificationLink khi có front-end fogetpassword
            })
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Sai mật khẩu' });
        }
        const token = createToken(user);
        res.cookie('jwt', token, {
            httpOnly: true,
            maxAge: maxAge * 1000,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        res.status(200).json({
            message: 'Login successful',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatar_url: user.avatar_url,
                token: token,
                membership: user.membership
            }
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
// Forget password
module.exports.fogotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Sai email' });
        }

        const ressetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '10m' });

        user.ressetPasswordToken = ressetToken;
        user.ressetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        const resetLink = `http://localhost:${process.env.VITE_PORT}/resset-password/${ressetToken}`; // sẽ sửa lại resetLink khi có front-end fogetpassword
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Đặt lại mật khẩu',
            html: `
            <!DOCTYPE html>
            <html>
                <body style="margin: 0; padding: 20px; background-color: #f4f4f4; font-family: Arial, sans-serif;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #2C3E50; text-align: center; margin-bottom: 20px; font-size: 24px;">Xin chào ${user.name}!</h2>
                        <div style="color: #666; line-height: 1.6; font-size: 16px;">
                            <p style="margin-bottom: 15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
                            <div style="text-align: center; margin: 25px 0;">
                                <a href="${resetLink}" 
                                   style="background-color: #3498DB; 
                                          color: white; 
                                          padding: 12px 30px; 
                                          text-decoration: none; 
                                          border-radius: 5px; 
                                          font-weight: bold;
                                          display: inline-block;">
                                    Đặt lại mật khẩu
                                </a>
                            </div>
                            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 20px;">Link này sẽ hết hạn sau 10 phút.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px; text-align: center;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                        </div>
                    </div>
                </body>
            </html>
        `
        }

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
        })

        return res.status(200).json({
            message: 'Email sent successfully'
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
// Request password reset with OTP
module.exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const otp = generateOtp();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Mã đặt lại mật khẩu của bạn',
            html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body style="margin: 0; padding: 0; background-color: #f7f7f7; font-family: Arial, sans-serif;">
                        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; padding: 40px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div style="text-align: center; margin-bottom: 30px;">
                                <h1 style="color: #1a73e8; font-size: 28px; margin: 0; padding: 0;">Đặt lại mật khẩu</h1>
                                <p style="color: #5f6368; font-size: 16px; margin-top: 10px;">Vui lòng nhập mã bên dưới để xác thực đổi lại mật khẩu</p>
                            </div>
                            
                            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center; margin: 20px 0;">
                                <div style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a73e8; font-family: monospace;">
                                    ${otp}
                                </div>
                            </div>

                            <div style="text-align: center; margin-top: 30px;">
                                <p style="color: #5f6368; font-size: 14px; margin: 0;">Code này sẽ hết hạn trong 10 phút</p>
                                <p style="color: #5f6368; font-size: 14px; margin-top: 20px;">Nếu bạn không yêu cầu mã này, bạn có thể bỏ qua email này một cách an toàn.</p>
                            </div>

                            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                                <p style="color: #5f6368; font-size: 12px; margin: 0;">
                                    Đây là một email tự động, vui lòng không trả lời.
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            console.log('Email sent:', info.response);
        });

        res.status(200).json({ message: 'Password reset OTP sent to your email.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Verify reset OTP
module.exports.verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.otp !== otp || Date.now() > user.otpExpires) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // OTP is correct, generate a temporary reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.ressetPasswordToken = resetToken;
        user.ressetPasswordExpires = Date.now() + 5 * 60 * 1000; // 5 minutes to reset password

        // Clear OTP fields
        user.otp = null;
        user.otpExpires = null;

        await user.save();

        res.status(200).json({ message: 'OTP verified successfully', resetToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// Resset password 
module.exports.ressetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findOne({
            _id: decoded.id,
            ressetPasswordToken: token,
            ressetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid token or token has expried' });
        }

        user.password = newPassword;
        user.markModified('password');

        user.ressetPasswordToken = undefined;
        user.ressetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Reset password after OTP verification
module.exports.resetPasswordMobile = async (req, res) => {
    try {
        const { email, newPassword, resetToken } = req.body;

        const user = await User.findOne({
            email,
            ressetPasswordToken: resetToken,
            ressetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        user.password = newPassword;
        user.ressetPasswordToken = undefined;
        user.ressetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports.googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        let user = await User.findOne({ email: payload.email });

        if (!user) {
            // Create new user without password for Google authentication
            user = new User({
                email: payload.email,
                name: payload.name,
                avatar_url: payload.picture,
                googleId: payload.sub,
                isVerified: payload.email_verified,
                role: 'user',
                membership: 'free'
            });
            await user.save();

            // Tìm gói free trong Package collection
            const freePackage = await Package.findOne({ name: 'free' });
            if (!freePackage) {
                throw new Error('Free package not found');
            }

            // Tạo subscription mới cho user với gói free
            const newSubscription = new Subscription({
                user_id: user._id,
                package_id: freePackage._id,
                name: freePackage.name,
                price: freePackage.price,
                start_date: new Date(),
                end_date: null, // Gói free không có ngày hết hạn
                status: 'active'
            });

            await newSubscription.save();

        } else if (!user.googleId) {
            // Update existing user's Google-related info
            user.googleId = payload.sub;
            user.avatar_url = payload.picture;
            user.isVerified = payload.email_verified;
            await user.save();
        }

        // Create JWT token
        const token = createToken(user);

        // Set cookie
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: maxAge * 1000,
            sameSite: 'lax'
        });

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar_url: user.avatar_url,
                role: user.role,
                isVerified: user.isVerified,
                membership: user.membership,
                token: token
            }
        });

    } catch (error) {
        console.error('Google auth error:', error);
        return res.status(401).json({
            success: false,
            message: 'Google authentication failed'
        });
    }
};