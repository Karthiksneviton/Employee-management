const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

function sessionExpiry(token) {
    const payload = jwt.decode(token);
    return payload && payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : null;
}

async function changeAdminPassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};
    if (
        typeof currentPassword !== "string" ||
        !currentPassword ||
        Buffer.byteLength(currentPassword, "utf8") > 72 ||
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        return res.status(400).json({
            message: "Enter your current password and a new password of at least 12 characters and no more than 72 bytes"
        });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;

        const { rows } = await client.query(
            `SELECT id, username, password_hash, auth_version, status
             FROM admins
             WHERE id = $1
             FOR UPDATE`,
            [req.admin.id]
        );
        const admin = rows[0];
        if (!admin || admin.status !== "active") {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(401).json({ message: "Administrator account is unavailable" });
        }

        const currentPasswordMatches = await bcrypt.compare(
            currentPassword,
            admin.password_hash
        );
        if (!currentPasswordMatches) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        if (await bcrypt.compare(newPassword, admin.password_hash)) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(400).json({
                message: "Choose a password you have not used for this account"
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        const updated = await client.query(
            `UPDATE admins
             SET password_hash = $1,
                 auth_version = auth_version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, username, role, auth_version`,
            [passwordHash, admin.id]
        );

        await client.query(
            `INSERT INTO hr_audit_logs
                (actor_type, actor_id, action, entity_type, entity_id, details)
             VALUES ('admin', $1, 'admin.password.changed', 'admin_account', $1, '{}'::jsonb)`,
            [admin.id]
        );
        await client.query("COMMIT");
        transactionOpen = false;

        const updatedAdmin = updated.rows[0];
        const token = jwt.sign(
            {
                id: updatedAdmin.id,
                username: updatedAdmin.username,
                role: updatedAdmin.role,
                authVersion: updatedAdmin.auth_version
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
        );

        return res.json({
            message: "Password changed. Other administrator sessions have been signed out.",
            token,
            sessionExpiresAt: sessionExpiry(token)
        });
    } catch (error) {
        if (transactionOpen && client) {
            await client.query("ROLLBACK");
        }
        console.error("Admin password change error:", error);
        return res.status(500).json({ message: "Unable to change administrator password" });
    } finally {
        if (client) client.release();
    }
}

module.exports = { changeAdminPassword };
