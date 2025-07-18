const jwt = require('jsonwebtoken');

const validateToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Invalid authorization header format' });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (jwtError) {
            console.error('JWT Verification Error:', jwtError);
            return res.status(401).json({
                error: 'Invalid token',
                details: jwtError.message
            });
        }

    } catch (err) {
        console.error('Auth Middleware Error:', err);
        return res.status(500).json({
            error: 'Authentication failed',
            details: err.message
        });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        try {
            const userRole = req.user.role;
            if (!roles.includes(userRole)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have permission to perform this action'
                })
            }

            next();
        } catch (error) {
            console.error('Role Check Error:', error);
            return res.status(500).json({
                error: 'Role check failed',
                details: error.message
            });
        }
    }
}

module.exports = { validateToken, checkRole };