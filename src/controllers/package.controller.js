// controllers/package.controller.js
const Package = require('../models/package.model');

// --- 1. CREATE: Tạo một gói mới ---
module.exports.createPackage = async (req, res) => {
    try {
        // Lấy dữ liệu từ body của request
        const { name, price, duration_days, features, description } = req.body;
        // Kiểm tra dữ liệu đầu vào
        if (!name || price === undefined || duration_days === undefined) {
            return res.status(400).json({ message: 'Tên gói, giá và thời hạn là bắt buộc.' });
        }

        // Kiểm tra xem gói đã tồn tại chưa
        const existingPackage = await Package.findOne({ name });
        if (existingPackage) {
            return res.status(409).json({ message: 'Gói với tên này đã tồn tại.' });
        }

        // Tạo instance mới của Package
        const newPackage = new Package({
            name,
            price,
            duration_days,
            features,
            description,
        });

        // Lưu vào database
        const savedPackage = await newPackage.save();

        res.status(201).json({
            message: 'Tạo gói thành công!',
            package: savedPackage,
        });
    } catch (error) {
        // Xử lý lỗi từ Mongoose (ví dụ: validation, cast error)
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Dữ liệu không hợp lệ.', errors: error.errors });
        }
        if (error.code === 11000) { // Duplicate key error
            return res.status(409).json({ message: 'Gói với tên này đã tồn tại.' });
        }
        console.error('Lỗi khi tạo gói:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};

// --- 2. READ ALL: Lấy tất cả các gói ---
module.exports.getAllPackages = async (req, res) => {
    try {
        const packages = await Package.find({ is_active: true }); 
        res.status(200).json({
            message: 'Lấy danh sách gói thành công!',
            count: packages.length,
            packages,
        });
    } catch (error) {
        console.error('Lỗi khi lấy tất cả gói:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};

// --- 3. READ ONE: Lấy một gói theo ID ---
module.exports.getPackageById = async (req, res) => {
    try {
        const { id } = req.params;

        // Tìm gói theo ID
        const packageItem = await Package.findById(id);

        if (!packageItem) {
            return res.status(404).json({ message: 'Không tìm thấy gói.' });
        }

        res.status(200).json({
            message: 'Lấy gói thành công!',
            package: packageItem,
        });
    } catch (error) {
        // Xử lý lỗi ID không hợp lệ (ví dụ: '60c72b2f...')
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'ID gói không hợp lệ.' });
        }
        console.error('Lỗi khi lấy gói theo ID:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};

// --- 4. UPDATE: Cập nhật một gói theo ID ---
module.exports.updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // Dữ liệu cần cập nhật

        // Dữ liệu update sẽ được Mongoose schema validation kiểm tra
        const updatedPackage = await Package.findByIdAndUpdate(
            id,
            { $set: updates }, // Sử dụng $set để chỉ cập nhật các trường được truyền vào
            { new: true, runValidators: true } // `new: true` trả về document đã cập nhật, `runValidators: true` chạy validation trên update
        );

        if (!updatedPackage) {
            return res.status(404).json({ message: 'Không tìm thấy gói để cập nhật.' });
        }

        res.status(200).json({
            message: 'Cập nhật gói thành công!',
            package: updatedPackage,
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'ID gói không hợp lệ.' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Dữ liệu cập nhật không hợp lệ.', errors: error.errors });
        }
        console.error('Lỗi khi cập nhật gói:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};

// --- 5. DELETE: Xóa một gói theo ID ---
module.exports.deletePackage = async (req, res) => {
    try {
        const { id } = req.params;

        const packageItem = await Package.findById(id);

        const deactivatedPackage = await Package.findByIdAndUpdate(
            id,
            { $set: { is_active: !packageItem.is_active } },
            { new: true }
        );

        if (!deactivatedPackage) {
            return res.status(404).json({ message: 'Không tìm thấy gói để vô hiệu hóa.' });
        }

        res.status(200).json({
            message: 'Khóa gói hoặc mở khóa gói thành công!',
            package: deactivatedPackage, // Trả về document đã vô hiệu hóa
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'ID gói không hợp lệ.' });
        }
        console.error('Lỗi khi xóa gói:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};

module.exports.getAllPackagesForAdmin = async (req, res) => {
    try {
        const packages = await Package.find();
        res.status(200).json({
            message: 'Lấy danh sách gói thành công!',
            count: packages.length,
            packages,
        });
    } catch (error) {
        console.error('Lỗi khi lấy tất cả gói:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: error.message });
    }
};