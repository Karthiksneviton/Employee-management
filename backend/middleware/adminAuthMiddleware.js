const jwt = require("jsonwebtoken");

async function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({
            message: "Administrator authentication token required"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "admin" || !decoded.id ||
            !Number.isSafeInteger(decoded.authVersion)) {
            return res.status(403).json({
                message: "Administrator access only"
            });
        }

        const result = await req.app.locals.pool.query(
            `SELECT status, auth_version
             FROM admins
             WHERE id = $1`,
            [decoded.id]
        );
        const admin = result.rows[0];
        if (!admin || admin.status !== "active" ||
            admin.auth_version !== decoded.authVersion) {
            return res.status(401).json({
                message: "Administrator session is no longer valid"
            });
        }

        req.admin = decoded;
        return next();
    } catch (error) {
        if (error.name !== "JsonWebTokenError" &&
            error.name !== "TokenExpiredError" &&
            error.name !== "NotBeforeError") {
            console.error("Administrator authentication error:", error);
            return res.status(503).json({
                message: "Unable to verify administrator session"
            });
        }
        return res.status(401).json({
            message: "Invalid or expired administrator token"
        });
    }
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.admin || !roles.includes(req.admin.role)) {
            return res.status(403).json({
                message: "You do not have permission to perform this action"
            });
        }

        return next();
    };
}

module.exports = {
    authenticateAdmin,
    authorizeRoles
};
