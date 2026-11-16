
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const employeeAccountModel = require("../models/employeeAccountModel");
const { writeAuditLog } = require("./hrController");

// =====================================
// ADMIN: CREATE EMPLOYEE LOGIN ACCOUNT
// =====================================

async function createEmployeeAccount(req, res) {
    try {
        const { employeeId, temporaryPassword } = req.body || {};

        if (!employeeId || !temporaryPassword) {
            return res.status(400).json({
                message: "Employee ID and temporary password are required"
            });
        }

        const id = Number(employeeId);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid employee ID"
            });
        }

        if (
            typeof temporaryPassword !== "string" ||
            temporaryPassword.length < 12 ||
            Buffer.byteLength(temporaryPassword, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "Temporary password must contain 12 to 72 bytes"
            });
        }

        const employeeResult = await req.app.locals.pool.query(
            "SELECT id, name, email, status FROM employees WHERE id = $1",
            [id]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }
        if (["inactive", "terminated"].includes(employeeResult.rows[0].status)) {
            return res.status(409).json({
                message: "Cannot create a login account for an inactive employee"
            });
        }

        const passwordHash = await bcrypt.hash(
            temporaryPassword,
            12
        );

        const client = await req.app.locals.pool.connect();
        let transactionOpen = false;
        let account;
        try {
            await client.query("BEGIN");
            transactionOpen = true;
            account = await employeeAccountModel.createEmployeeAccount(
                client,
                id,
                passwordHash
            );
            await writeAuditLog(client, {
                actorType: "admin",
                actorId: req.admin.id,
                action: "admin.employee_account.created",
                entityType: "employee_account",
                entityId: account.id,
                details: { employeeId: id }
            });
            await client.query("COMMIT");
            transactionOpen = false;
        } catch (error) {
            if (transactionOpen) await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }

        return res.status(201).json({
            message: "Employee login account created successfully",
            account
        });

    } catch (error) {
        console.error("Create employee account error:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                message: "This employee already has a login account"
            });
        }

        return res.status(500).json({
            message: "Failed to create employee account"
        });
    }
}

// =====================================
// ADMIN: GENERATE / RESET PASSWORD
// =====================================

async function generateEmployeePassword(req, res) {
    try {
        const id = Number(req.params.employeeId);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid employee ID"
            });
        }

        const employeeResult = await req.app.locals.pool.query(
            "SELECT id, name, email, status FROM employees WHERE id = $1",
            [id]
        );

        if (employeeResult.rows.length === 0) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }
        if (["inactive", "terminated"].includes(employeeResult.rows[0].status)) {
            return res.status(409).json({
                message: "Cannot create a login account for an inactive employee"
            });
        }

        const temporaryPassword = crypto
            .randomBytes(18)
            .toString("base64url");

        const passwordHash = await bcrypt.hash(
            temporaryPassword,
            12
        );

        const client = await req.app.locals.pool.connect();
        let transactionOpen = false;
        let account;
        try {
            await client.query("BEGIN");
            transactionOpen = true;
            const result = await client.query(
            `INSERT INTO employee_accounts
                (employee_id, password_hash, status, must_change_password)
             VALUES ($1, $2, 'active', TRUE)
             ON CONFLICT (employee_id)
             DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                status = 'active',
                must_change_password = TRUE,
                auth_version = employee_accounts.auth_version + 1,
                updated_at = CURRENT_TIMESTAMP
             RETURNING id, employee_id, status`,
            [id, passwordHash]
            );
            account = result.rows[0];
            await writeAuditLog(client, {
                actorType: "admin",
                actorId: req.admin.id,
                action: "admin.employee_password.reset",
                entityType: "employee_account",
                entityId: account.id,
                details: { employeeId: id }
            });
            await client.query("COMMIT");
            transactionOpen = false;
        } catch (error) {
            if (transactionOpen) await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }

        return res.status(200).json({
            message: "Employee password generated successfully",
            employee: employeeResult.rows[0],
            account,
            temporaryPassword
        });

    } catch (error) {
        console.error("Generate employee password error:", error);

        return res.status(500).json({
            message: "Failed to generate employee password"
        });
    }
}

async function changeEmployeePassword(req, res) {
    const { currentPassword, newPassword } = req.body || {};

    if (
        typeof currentPassword !== "string" ||
        !currentPassword ||
        Buffer.byteLength(currentPassword, "utf8") > 72
    ) {
        return res.status(400).json({
            message: "Current password is required and must not exceed 72 bytes"
        });
    }

    if (
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        return res.status(400).json({
            message: "New password must contain at least 12 characters and no more than 72 bytes"
        });
    }

    try {
        const result = await req.app.locals.pool.query(
            `SELECT id AS account_id, password_hash, status, auth_version
             FROM employee_accounts
             WHERE employee_id = $1`,
            [req.employee.id]
        );

        const account = result.rows[0];

        if (!account || account.status !== "active") {
            return res.status(404).json({
                message: "Active employee account not found"
            });
        }

        const currentPasswordMatches = await bcrypt.compare(
            currentPassword,
            account.password_hash
        );

        if (!currentPasswordMatches) {
            return res.status(401).json({
                message: "Current password is incorrect"
            });
        }

        const newPasswordMatches = await bcrypt.compare(
            newPassword,
            account.password_hash
        );

        if (newPasswordMatches) {
            return res.status(400).json({
                message: "New password must be different from the current password"
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        const client = await req.app.locals.pool.connect();
        let transactionOpen = false;
        let updated;
        try {
            await client.query("BEGIN");
            transactionOpen = true;
            updated = await client.query(
                `UPDATE employee_accounts
                 SET password_hash = $1,
                     must_change_password = FALSE,
                     auth_version = auth_version + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE employee_id = $2
                   AND password_hash = $3
                   AND auth_version = $4
                 RETURNING auth_version`,
                [passwordHash, req.employee.id, account.password_hash, account.auth_version]
            );
            if (!updated.rows.length) {
                await client.query("ROLLBACK");
                transactionOpen = false;
                return res.status(409).json({
                    message: "The account changed during this request. Please sign in again."
                });
            }
            await writeAuditLog(client, {
                actorType: "employee",
                actorId: req.employee.id,
                action: "employee.password.changed",
                entityType: "employee_account",
                entityId: account.account_id,
                details: {}
            });
            await client.query("COMMIT");
            transactionOpen = false;
        } catch (error) {
            if (transactionOpen) await client.query("ROLLBACK");
            throw error;
        } finally {
            client.release();
        }
        const token = jwt.sign(
            {
                id: req.employee.id,
                employeeId: req.employee.id,
                role: "employee",
                tokenType: "employee",
                mustChangePassword: false,
                authVersion: updated.rows[0].auth_version
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
        );

        return res.json({
            message: "Password changed successfully",
            token
        });
    } catch (error) {
        console.error("Change employee password error:", error);
        return res.status(500).json({
            message: "Failed to change password"
        });
    }
}

// =====================================
// EMPLOYEE: LOGIN
// =====================================

async function employeeLogin(req, res) {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            Buffer.byteLength(password, "utf8") > 72 ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const account =
            await employeeAccountModel.findEmployeeAccountByEmail(
                req.app.locals.pool,
                email.trim()
            );

        if (!account || account.status !== "active") {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const passwordValid = await bcrypt.compare(
            password,
            account.password_hash
        );

        if (!passwordValid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        await req.app.locals.pool.query(
            `INSERT INTO employee_login_activity
                (employee_id, ip_address, user_agent)
             VALUES ($1, $2, $3)`,
            [
                account.employee_id,
                req.ip || null,
                String(req.get("user-agent") || "").slice(0, 500) || null
            ]
        );

        const token = jwt.sign(
            {
                id: account.employee_id,
                employeeId: account.employee_id,
                accountId: account.account_id,
                role: "employee",
                tokenType: "employee",
                mustChangePassword: account.must_change_password,
                authVersion: account.auth_version
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1h"
            }
        );

        return res.json({
            message: "Employee login successful",
            token,
            employee: {
                id: account.employee_id,
                name: account.name,
                email: account.email,
                role: account.role,
                department: account.department,
                status: account.employee_status,
                mustChangePassword: account.must_change_password
            }
        });

    } catch (error) {
        console.error("Employee login error:", error);

        return res.status(500).json({
            message: "Employee login failed"
        });
    }
}

// =====================================
// EXPORT CONTROLLERS
// =====================================

module.exports = {
    createEmployeeAccount,
    generateEmployeePassword,
    changeEmployeePassword,
    employeeLogin
};
