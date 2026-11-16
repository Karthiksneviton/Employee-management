const employeeAuthController =
    require("./controllers/employeeAuthController");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const fs = require("node:fs/promises");
const path = require("node:path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const attendanceRoutes = require("./routes/attendanceRoutes");
const employeeAuthRoutes = require("./routes/employeeAuthRoutes");
const employeeWorkRoutes = require("./routes/employeeWorkRoutes");
const adminHrRoutes = require("./routes/adminHrRoutes");
const { authenticateEmployee } = require("./middleware/employeeAuthMiddleware");
const { csvCell, writeAuditLog } = require("./controllers/hrController");
const { changeAdminPassword } = require("./controllers/adminAuthController");
const {
    authenticateAdmin: authenticateToken,
    authorizeRoles
} = require("./middleware/adminAuthMiddleware");
const validateEmployee = require("./utils/employeeValidation");
require("dotenv").config({
    path: path.resolve(__dirname, "..", ".env")
});

const app = express();
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);

// PostgreSQL connection
const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRES_USER,
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
    database: process.env.DB_NAME || process.env.POSTGRES_DB
});
app.locals.pool = pool;
// Database error handling
pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

// Middleware
app.use(helmet());
const allowedOrigins = (
    process.env.CLIENT_URL || "http://localhost:5173"
)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({
    limit: "10kb"
}));
app.use("/api/employee/attendance", attendanceRoutes);
app.use("/api/employee/auth", employeeAuthRoutes);
app.use("/api/employee", employeeWorkRoutes);
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in 15 minutes." }
});
app.get("/api/employee/me", authenticateEmployee, async (req, res) => {
    try {
        const [result, attendanceResult, leaveResult, preferenceResult, activityResult] =
            await Promise.all([
                pool.query(
                    `SELECT e.*, manager.name AS manager_name
                     FROM employees e
                     LEFT JOIN employees manager ON manager.id = e.manager_id
                     WHERE e.id = $1`,
                    [req.employee.id]
                ),
                pool.query(
                    `SELECT
                        COUNT(*) FILTER (WHERE status = 'present')::int AS present,
                        COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
                        COUNT(*) FILTER (WHERE status = 'late')::int AS late,
                        COUNT(*) FILTER (WHERE status = 'leave')::int AS leave
                     FROM attendance
                     WHERE employee_id = $1`,
                    [req.employee.id]
                ),
                pool.query(
                    `SELECT COALESCE(SUM(
                        GREATEST(
                            0,
                            LEAST(end_date, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 1, 1) - 1)
                            - GREATEST(start_date, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1))
                            + 1
                        )
                    ), 0)::numeric AS used_days
                     FROM leave_requests
                     WHERE employee_id = $1 AND status = 'approved'
                       AND start_date < make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 1, 1)
                       AND end_date >= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)`,
                    [req.employee.id]
                ),
                pool.query(
                    `SELECT email_notifications, leave_updates, announcements,
                            attendance_alerts, language, time_zone, theme
                     FROM employee_preferences WHERE employee_id = $1`,
                    [req.employee.id]
                ),
                pool.query(
                    `SELECT created_at, user_agent
                     FROM employee_login_activity
                     WHERE employee_id = $1
                     ORDER BY created_at DESC
                     LIMIT 10`,
                    [req.employee.id]
                )
            ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Employee profile not found"
            });
        }

        const profile = result.rows[0];
        const usedLeaveDays = Number(leaveResult.rows[0].used_days);
        const leaveEntitlement = Number(profile.annual_leave_entitlement || 0);
        return res.json({
            employee: {
                ...profile,
                attendance: attendanceResult.rows[0],
                leave: {
                    entitlement: leaveEntitlement,
                    used: usedLeaveDays,
                    remaining: leaveEntitlement > 0
                        ? Math.max(0, leaveEntitlement - usedLeaveDays)
                        : null
                },
                preferences: preferenceResult.rows[0] || {
                    email_notifications: true,
                    leave_updates: true,
                    announcements: true,
                    attendance_alerts: true,
                    language: "en",
                    time_zone: "Asia/Kolkata",
                    theme: "system"
                },
                login_activity: activityResult.rows
            }
        });
    } catch (error) {
        console.error("Employee profile error:", error);
        return res.status(500).json({
            message: "Unable to load employee profile"
        });
    }
});

app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (typeof username !== "string" || !username.trim() ||
            typeof password !== "string" || !password ||
            Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const result = await pool.query(
            `SELECT id, username, password_hash, role, status, auth_version
             FROM admins WHERE username = $1`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const admin = result.rows[0];
        if (admin.status !== "active") {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const loginUpdate = await pool.query(
            `UPDATE admins
             SET last_login_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'active'
             RETURNING auth_version, last_login_at`,
            [admin.id]
        );
        if (!loginUpdate.rows.length) {
            return res.status(401).json({
                message: "Invalid username or password"
            });
        }

        const token = jwt.sign(
            {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                authVersion: loginUpdate.rows[0].auth_version
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
        );
        const tokenPayload = jwt.decode(token);

        return res.json({
            message: "Login successful",
            token,
            sessionExpiresAt: tokenPayload?.exp
                ? new Date(tokenPayload.exp * 1000).toISOString()
                : null,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                status: admin.status,
                lastLoginAt: loginUpdate.rows[0].last_login_at
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Login failed"
        });
    }
});

app.post(
    "/api/auth/change-password",
    authenticateToken,
    authorizeRoles("admin"),
    changeAdminPassword
);

app.get(
    "/api/admin/me",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT id, username, role, status, last_login_at
                 FROM admins WHERE id = $1`,
                [req.admin.id]
            );
            if (!result.rows.length) {
                return res.status(404).json({ message: "Administrator account not found" });
            }
            const admin = result.rows[0];
            return res.json({
                admin: {
                    ...admin,
                    lastLoginAt: admin.last_login_at,
                    sessionExpiresAt: new Date(req.admin.exp * 1000).toISOString()
                }
            });
        } catch (error) {
            console.error("Admin account details error:", error);
            return res.status(500).json({ message: "Unable to load administrator account" });
        }
    }
);
app.use("/api/admin", adminHrRoutes);
// =====================================
// ADMIN: EMPLOYEE ACCOUNT LIST
// =====================================

app.get(
    "/api/admin/employee-accounts",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    e.id AS employee_id,
                    e.name,
                    e.email,
                    e.department,
                    e.role,
                    e.status AS employee_status,
                    ea.id AS account_id,
                    ea.status,
                    ea.created_at
                FROM employees e
                LEFT JOIN employee_accounts ea
                    ON e.id = ea.employee_id
                ORDER BY e.id DESC
            `);

            res.json(result.rows);

        } catch (error) {
            console.error("Employee accounts error:", error);

            res.status(500).json({
                message: "Failed to fetch employee accounts"
            });
        }
    }
);
// =====================================
// EMPLOYEE AUTHENTICATION ROUTES
// =====================================

// Admin creates employee login account
// Admin creates an employee login account
app.post(
    "/api/admin/employee-accounts",
    authenticateToken,
    authorizeRoles("admin"),
    employeeAuthController.createEmployeeAccount
);

// Admin generates or resets an employee password
app.post(
    "/api/admin/employee-accounts/:employeeId/generate-password",
    authenticateToken,
    authorizeRoles("admin"),
    employeeAuthController.generateEmployeePassword
);
// Home API
app.get("/", (req, res) => {
    res.json({
        message: "Employee Management Backend",
        status: "Running"
    });
});

// Health API
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            status: "UP",
            database: "Connected",
            message: "Backend and database are healthy"
        });

    } catch (error) {
        console.error("Health check failed:", error);

        res.status(503).json({
            status: "DOWN",
            database: "Disconnected",
            message: "Database connection unavailable"
        });
    }
});

function employeeFilters(req) {
    const search = typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "";
    const department = typeof req.query.department === "string"
        ? req.query.department.trim().slice(0, 100)
        : "";
    return { search, department };
}

function employeePage(value) {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0
        ? Math.min(page, 1000000)
        : 1;
}

function employeeQuery(filters) {
    const conditions = [];
    const params = [];
    if (filters.search) {
        params.push(`%${filters.search}%`);
        conditions.push(`(name ILIKE $${params.length}
            OR first_name ILIKE $${params.length}
            OR last_name ILIKE $${params.length}
            OR email ILIKE $${params.length}
            OR role ILIKE $${params.length}
            OR department ILIKE $${params.length}
            OR phone ILIKE $${params.length}
            OR employee_code ILIKE $${params.length})`);
    }
    if (filters.department && filters.department !== "All") {
        params.push(filters.department);
        conditions.push(`department = $${params.length}`);
    }
    return {
        where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        params
    };
}

app.get(
    "/api/employees/export.csv",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const filters = employeeFilters(req);
            const { where, params } = employeeQuery(filters);
            const result = await pool.query(
                `SELECT id, name, first_name, last_name, email, phone, role,
                        department, employee_code, employment_type, status, created_at
                 FROM employees ${where}
                 ORDER BY id`,
                params
            );
                const columns = [
                    "id", "employee_code", "first_name", "last_name", "name",
                    "email", "phone", "role", "department", "employment_type",
                    "status", "created_at"
                ];
            const rows = [
                columns.map(csvCell).join(","),
                ...result.rows.map(row => columns.map(column => csvCell(row[column])).join(","))
            ];
            res.type("text/csv");
            res.setHeader("Content-Disposition", 'attachment; filename="employees.csv"');
            return res.send(rows.join("\r\n"));
        } catch (error) {
            console.error("Export employees error:", error);
            return res.status(500).json({ message: "Failed to export employees" });
        }
    }
);

// Get paginated employees
app.get(
    "/api/employees",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
    try {
        const filters = employeeFilters(req);
        const page = employeePage(req.query.page);
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isInteger(requestedLimit)
            ? Math.min(100, Math.max(1, requestedLimit))
            : 25;
        const offset = (page - 1) * limit;
        const { where, params } = employeeQuery(filters);
        const [countResult, employeeResult] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total FROM employees ${where}`, params),
            pool.query(
                `SELECT id, employee_code, name, first_name, last_name, email,
                        phone, role, department, employment_type, status,
                        created_at
                 FROM employees ${where}
                 ORDER BY id
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limit, offset]
            )
        ]);
        const total = countResult.rows[0].total;
        return res.json({
            employees: employeeResult.rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Fetch employees error:", error);
        return res.status(500).json({
            message: "Failed to fetch employees"
        });
    }
});

// Get employee by ID
app.get(
    "/api/employees/managers",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT id, employee_code, name, department, role
                 FROM employees
                 WHERE status = 'active'
                 ORDER BY name, id`
            );
            return res.json({ managers: result.rows });
        } catch (error) {
            console.error("Fetch employee managers error:", error);
            return res.status(500).json({ message: "Failed to fetch reporting managers" });
        }
    }
);

app.get(
    "/api/employees/:id",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid employee ID"
            });
        }

        const result = await pool.query(
            `SELECT e.*, manager.name AS manager_name
             FROM employees e
             LEFT JOIN employees manager ON manager.id = e.manager_id
             WHERE e.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        const [attendanceResult, leaveResult] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE status = 'present')::int AS present,
                    COUNT(*) FILTER (WHERE status = 'absent')::int AS absent,
                    COUNT(*) FILTER (WHERE status = 'late')::int AS late,
                    COUNT(*) FILTER (WHERE status = 'leave')::int AS leave
                 FROM attendance WHERE employee_id = $1`,
                [id]
            ),
            pool.query(
                `SELECT COALESCE(SUM(
                    GREATEST(
                        0,
                        LEAST(end_date, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 1, 1) - 1)
                        - GREATEST(start_date, make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1))
                        + 1
                    )
                ), 0)::numeric AS used_days
                 FROM leave_requests
                 WHERE employee_id = $1 AND status = 'approved'
                   AND start_date < make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, 1, 1)
                   AND end_date >= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, 1, 1)`,
                [id]
            )
        ]);
        const employee = result.rows[0];
        const usedLeaveDays = Number(leaveResult.rows[0].used_days);
        const leaveEntitlement = Number(employee.annual_leave_entitlement || 0);
        return res.json({
            employee,
            attendance: attendanceResult.rows[0],
            leave: {
                entitlement: leaveEntitlement,
                used: usedLeaveDays,
                remaining: leaveEntitlement > 0
                    ? Math.max(0, leaveEntitlement - usedLeaveDays)
                    : null
            }
        });
    } catch (error) {
        console.error("Get employee error:", error);
        res.status(500).json({
            message: "Failed to fetch employee"
        });
    }
});

// Add employee
// Admin Login API

// Add employee

app.post(
  "/api/employees",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    // Keep your existing code
  
        try {
            const validation = validateEmployee(req.body);

            if (Array.isArray(validation)) {
                return res.status(400).json({
                    message: "Validation failed",
                    errors: validation
                });
            }

            const result = await pool.query(
                `INSERT INTO employees
                 (name, first_name, last_name, email, role, department, status,
                  phone, date_of_birth, gender, address, city, state, country,
                  employment_type, joining_date, manager_id, work_location,
                  emergency_contact_name, emergency_contact_relationship,
                  emergency_contact_phone, emergency_contact_email,
                  annual_leave_entitlement)
                 VALUES (${Array.from({ length: 23 }, (_, index) => `$${index + 1}`).join(", ")})
                 RETURNING *`,
                Object.values(validation.employee)
            );

            return res.status(201).json({
                message: "Employee added successfully",
                employee: result.rows[0]
            });

        } catch (error) {
            console.error("Add employee error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    message: "Employee email already exists"
                });
            }

            return res.status(500).json({
                message: "Failed to add employee"
            });
        }
    }
);

// Update employee

app.put(
  "/api/employees/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    message: "Invalid employee ID"
                });
            }

            const validation = validateEmployee(req.body);

            if (Array.isArray(validation)) {
                return res.status(400).json({
                    message: "Validation failed",
                    errors: validation
                });
            }

            const result = await pool.query(
                `UPDATE employees
                 SET name = $1,
                     first_name = $2,
                     last_name = $3,
                     email = $4,
                     role = $5,
                     department = $6,
                     status = $7,
                     phone = $8,
                     date_of_birth = $9,
                     gender = $10,
                     address = $11,
                     city = $12,
                     state = $13,
                     country = $14,
                     employment_type = $15,
                     joining_date = $16,
                     manager_id = $17,
                     work_location = $18,
                     emergency_contact_name = $19,
                     emergency_contact_relationship = $20,
                     emergency_contact_phone = $21,
                     emergency_contact_email = $22,
                     annual_leave_entitlement = $23
                 WHERE id = $24
                 RETURNING *`,
                [...Object.values(validation.employee), id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    message: "Employee not found"
                });
            }

            const accountStatus = ["inactive", "terminated"].includes(result.rows[0].status)
                ? "inactive"
                : "active";
            await pool.query(
                `UPDATE employee_accounts
                 SET status = $1,
                     auth_version = auth_version + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE employee_id = $2 AND status IS DISTINCT FROM $1`,
                [accountStatus, id]
            );

            return res.json({
                message: "Employee updated successfully",
                employee: result.rows[0]
            });

        } catch (error) {
            console.error("Update employee error:", error);

            if (error.code === "23505") {
                return res.status(409).json({
                    message: "Employee email already exists"
                });
            }
            if (error.code === "23503") {
                return res.status(400).json({
                    message: "Select an existing reporting manager"
                });
            }

            return res.status(500).json({
                message: "Failed to update employee"
            });
        }
    }
);

app.patch(
    "/api/employees/:id/deactivate",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid employee ID" });
        }

        let client;
        let transactionOpen = false;
        try {
            client = await pool.connect();
            await client.query("BEGIN");
            transactionOpen = true;
            const result = await client.query(
                `UPDATE employees
                 SET status = 'inactive'
                 WHERE id = $1
                 RETURNING id, employee_code, name, email, status`,
                [id]
            );
            if (!result.rows.length) {
                await client.query("ROLLBACK");
                transactionOpen = false;
                return res.status(404).json({ message: "Employee not found" });
            }

            await client.query(
                `UPDATE employee_accounts
                 SET status = 'inactive',
                     auth_version = auth_version + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE employee_id = $1`,
                [id]
            );
            await writeAuditLog(client, {
                actorType: "admin",
                actorId: req.admin.id,
                action: "admin.employee.deactivated",
                entityType: "employee",
                entityId: id
            });
            await client.query("COMMIT");
            transactionOpen = false;
            return res.json({ employee: result.rows[0] });
        } catch (error) {
            if (transactionOpen && client) await client.query("ROLLBACK");
            console.error("Deactivate employee error:", error);
            return res.status(500).json({ message: "Failed to deactivate employee" });
        } finally {
            if (client) client.release();
        }
    }
);

// Delete employee
app.delete(
    "/api/employees/:id",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                message: "Invalid employee ID"
            });
        }

        const result = await pool.query(
            "DELETE FROM employees WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Employee not found"
            });
        }

        res.json({
            message: "Employee deleted successfully"
        });

    } catch (error) {
        console.error("Delete employee error:", error);
        res.status(500).json({
            message: "Failed to delete employee"
        });
    }
});
// Admin Dashboard Statistics
// Dashboard Statistics

// ========================================
// ADVANCED DASHBOARD STATISTICS API
// ========================================

app.get(
    "/api/dashboard/stats",
    authenticateToken,
    authorizeRoles("admin"),
    async (req, res) => {
        try {
            const [
                totalResult,
                departmentResult,
                monthlyResult,
                growthResult,
                recentResult
            ] = await Promise.all([

                // Total employees
                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM employees
                `),

                // Department distribution
                pool.query(`
                    SELECT
                        department,
                        COUNT(*)::int AS count
                    FROM employees
                    GROUP BY department
                    ORDER BY count DESC, department ASC
                `),

                // Employees added this month
                pool.query(`
                    SELECT COUNT(*)::int AS total
                    FROM employees
                    WHERE created_at >= date_trunc('month', CURRENT_DATE)
                      AND created_at < date_trunc('month', CURRENT_DATE)
                          + INTERVAL '1 month'
                `),

                // Employee growth over the last 6 months
                pool.query(`
                    WITH months AS (
                        SELECT generate_series(
                            date_trunc('month', CURRENT_DATE)
                                - INTERVAL '5 months',
                            date_trunc('month', CURRENT_DATE),
                            INTERVAL '1 month'
                        ) AS month
                    )
                    SELECT
                        TO_CHAR(months.month, 'Mon YYYY') AS month,
                        COUNT(employees.id)::int AS count
                    FROM months
                    LEFT JOIN employees
                        ON employees.created_at >= months.month
                        AND employees.created_at <
                            months.month + INTERVAL '1 month'
                    GROUP BY months.month
                    ORDER BY months.month
                `),

                // Latest five employees
                pool.query(`
                    SELECT
                        id,
                        name,
                        email,
                        role,
                        department,
                        created_at
                    FROM employees
                    ORDER BY created_at DESC, id DESC
                    LIMIT 5
                `)
            ]);

            const totalEmployees = totalResult.rows[0].total;
            const departmentStats = departmentResult.rows;
            const recentEmployees = recentResult.rows;

            res.json({
                totalEmployees,

                totalDepartments: departmentStats.length,

                newThisMonth: monthlyResult.rows[0].total,

                latestEmployee: recentEmployees[0] || null,

                departmentStats,

                employeeGrowth: growthResult.rows,

                recentEmployees
            });

        } catch (error) {
            console.error("Dashboard statistics error:", error);

            res.status(500).json({
                message: "Failed to load dashboard statistics"
            });
        }
    }
);
function validateEnvironment() {
    if (
        !process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32
    ) {
        throw new Error(
            "JWT_SECRET must be at least 32 characters"
        );
    }

    if (!process.env.ADMIN_USERNAME) {
        throw new Error("ADMIN_USERNAME is required");
    }

    if (
        !process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_PASSWORD.length < 12 ||
        Buffer.byteLength(process.env.ADMIN_PASSWORD, "utf8") > 72
    ) {
        throw new Error(
            "ADMIN_PASSWORD must be between 12 and 72 bytes"
        );
    }
}
async function initializeAdmin() {
    
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be at least 32 characters");
    }

    if (
        !username ||
        !password ||
        password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw new Error("Configure an admin password between 12 and 72 bytes");
    }

    const existing = await pool.query(
        "SELECT id FROM admins WHERE username = $1",
        [username]
    );

    if (existing.rows.length > 0) {
        console.log("Admin account already exists");
        return;
    }

    const hash = await bcrypt.hash(password, 12);

    await pool.query(
        `INSERT INTO admins (username, password_hash)
         VALUES ($1, $2)`,
        [username, hash]
    );

    console.log("Initial admin account created");
}

async function initializeDatabase() {
    const schemaFiles = [
        "core.sql",
        "employee_profiles.sql",
        "employee_accounts.sql",
        "attendance.sql",
        "hr_workflows.sql"
    ];

    for (const file of schemaFiles) {
        const schema = await fs.readFile(
            path.join(__dirname, "database", file),
            "utf8"
        );
        await pool.query(schema);
    }
}

// Start server after checking database connection

async function startServer() {
    try {
        // Validate required environment variables
        validateEnvironment();

        // Check PostgreSQL connection
        await pool.query("SELECT 1");

        console.log("PostgreSQL connected successfully");

        await initializeDatabase();

        // Create initial admin if it does not exist
        await initializeAdmin();

        // Start Express server
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Backend running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Backend startup failed:", error);
        process.exit(1);
    }
}

startServer();
