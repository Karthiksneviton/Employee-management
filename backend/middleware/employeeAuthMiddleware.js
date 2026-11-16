const jwt = require("jsonwebtoken");

async function authenticateEmployee(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Employee authentication token required"
        });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired employee token"
        });
    }

    // Do not accept administrator tokens.
    if (decoded.role !== "employee" || !decoded.id) {
        return res.status(403).json({
            message: "Employee access only"
        });
    }

    let account;
    try {
        const result = await req.app.locals.pool.query(
            `SELECT status, must_change_password, auth_version
             FROM employee_accounts
             WHERE employee_id = $1`,
            [decoded.id]
        );
        account = result.rows[0];
    } catch (error) {
        console.error("Employee authentication error:", error);
        return res.status(503).json({
            message: "Unable to verify employee session"
        });
    }

    if (
        !account ||
        account.status !== "active" ||
        account.auth_version !== decoded.authVersion
    ) {
        return res.status(401).json({
            message: "Employee session is no longer valid"
        });
    }

    if (account.must_change_password && req.path !== "/change-password") {
        return res.status(403).json({
            message: "Change your temporary password before continuing",
            code: "PASSWORD_CHANGE_REQUIRED"
        });
    }

    req.employee = {
        id: decoded.id,
        role: decoded.role,
        mustChangePassword: account.must_change_password
    };

    return next();
}

module.exports = {
    authenticateEmployee
};