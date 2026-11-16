const TIMEZONE = "Asia/Kolkata";
const validateEmployee = require("../utils/employeeValidation");
const PROFILE_FIELDS = [
    "name",
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "gender",
    "address",
    "city",
    "state",
    "country",
    "emergency_contact_name",
    "emergency_contact_relationship",
    "emergency_contact_phone",
    "emergency_contact_email"
];

async function writeAuditLog(db, {
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    details = {}
}) {
    return db.query(
        `INSERT INTO hr_audit_logs
            (actor_type, actor_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [actorType, actorId ?? null, action, entityType, entityId ?? null, JSON.stringify(details)]
    );
}

async function notifyAdmins(db, { title, message, entityType, entityId }) {
    return db.query(
        `INSERT INTO hr_notifications
            (recipient_type, recipient_id, title, message, entity_type, entity_id)
         SELECT 'admin', id, $1, $2, $3, $4
         FROM admins
         WHERE status = 'active'`,
        [title, message, entityType, entityId]
    );
}

async function notifyEmployee(db, {
    employeeId,
    title,
    message,
    entityType,
    entityId
}) {
    return db.query(
        `INSERT INTO hr_notifications
            (recipient_type, recipient_id, title, message, entity_type, entity_id)
        SELECT 'employee', employee_id, $1, $2, $3::text, $4
         FROM employee_accounts
         LEFT JOIN employee_preferences USING (employee_id)
         WHERE employee_id = $5 AND status = 'active'
          AND ($3::text <> 'leave_request' OR COALESCE(leave_updates, TRUE))`,
        [title, message, entityType, entityId, employeeId]
    );
}

async function getNotifications(req, res) {
    const recipientType = req.employee ? "employee" : "admin";
    const recipientId = req.employee ? req.employee.id : req.admin.id;
    try {
        const [notificationResult, unreadResult] = await Promise.all([
            req.app.locals.pool.query(
                `SELECT id, title, message, entity_type, entity_id, created_at, read_at
                 FROM hr_notifications
                 WHERE recipient_type = $1 AND recipient_id = $2
                 ORDER BY created_at DESC, id DESC
                 LIMIT 50`,
                [recipientType, recipientId]
            ),
            req.app.locals.pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM hr_notifications
                 WHERE recipient_type = $1 AND recipient_id = $2
                   AND read_at IS NULL`,
                [recipientType, recipientId]
            )
        ]);
        return res.json({
            notifications: notificationResult.rows,
            unreadCount: unreadResult.rows[0].count
        });
    } catch (error) {
        console.error("Notification list error:", error);
        return res.status(500).json({ message: "Unable to load notifications" });
    }
}

async function markNotificationRead(req, res) {
    const recipientType = req.employee ? "employee" : "admin";
    const recipientId = req.employee ? req.employee.id : req.admin.id;
    const providedId = (req.body || {}).id;
    const id = typeof providedId === "string" && /^\d+$/.test(providedId)
        ? Number(providedId)
        : providedId;
    if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) {
        return res.status(400).json({ message: "Invalid notification ID" });
    }

    try {
        const params = [recipientType, recipientId];
        let query = `UPDATE hr_notifications
                     SET read_at = CURRENT_TIMESTAMP
                     WHERE recipient_type = $1 AND recipient_id = $2
                       AND read_at IS NULL`;
        if (id !== undefined) {
            params.push(id);
            query += " AND id = $3";
        }
        const result = await req.app.locals.pool.query(query, params);
        return res.json({ updated: result.rowCount });
    } catch (error) {
        console.error("Mark notification read error:", error);
        return res.status(500).json({ message: "Unable to update notifications" });
    }
}

function isCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
}

function isLocalDateTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
        return false;
    }

    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));

    return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day &&
        parsed.getUTCHours() === hour &&
        parsed.getUTCMinutes() === minute;
}

function parsePage(value, fallback = 1) {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0
        ? Math.min(page, 1000000)
        : fallback;
}

function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

async function getEmployeeProfileChangeRequests(req, res) {
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, requested_changes, reason, status, admin_notes,
                    created_at, reviewed_at
             FROM employee_profile_change_requests
             WHERE employee_id = $1
             ORDER BY created_at DESC, id DESC`,
            [req.employee.id]
        );
        return res.json({ requests: rows });
    } catch (error) {
        console.error("Employee profile change request list error:", error);
        return res.status(500).json({ message: "Unable to load profile change requests" });
    }
}

async function createEmployeeProfileChangeRequest(req, res) {
    const body = req.body || {};
    const requestedChanges = body.changes;
    const reason = body.reason;
    if (
        !requestedChanges ||
        typeof requestedChanges !== "object" ||
        Array.isArray(requestedChanges) ||
        Object.keys(requestedChanges).some(field => !PROFILE_FIELDS.includes(field)) ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.trim().length > 1000
    ) {
        return res.status(400).json({ message: "Provide valid profile changes and a reason" });
    }

    const changesInput = { ...requestedChanges };
    if (typeof changesInput.name === "string" &&
        !("first_name" in changesInput) &&
        !("last_name" in changesInput)) {
        const [firstName, ...lastName] = changesInput.name.trim().split(/\s+/);
        changesInput.first_name = firstName;
        changesInput.last_name = lastName.join(" ");
        delete changesInput.name;
    }

    const suppliedFields = Object.keys(changesInput);
    if (!suppliedFields.length || suppliedFields.some(field =>
        typeof changesInput[field] !== "string" ||
        !changesInput[field].trim()
    )) {
        return res.status(400).json({ message: "Enter at least one non-empty profile change" });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        const employeeResult = await client.query(
            "SELECT * FROM employees WHERE id = $1",
            [req.employee.id]
        );
        const existing = employeeResult.rows[0];
        if (!existing) {
            return res.status(404).json({ message: "Employee profile not found" });
        }

        const validated = validateEmployee({ ...existing, ...changesInput });
        if (Array.isArray(validated)) {
            return res.status(400).json({ message: validated.join(". ") });
        }

        const changes = {};
        for (const field of suppliedFields) {
            if (validated.employee[field] !== existing[field]) {
                changes[field] = validated.employee[field];
            }
        }
        if (!Object.keys(changes).length) {
            return res.status(400).json({ message: "The requested values match your current profile" });
        }
        if (changes.email) {
            const duplicateEmail = await client.query(
                `SELECT id FROM employees
                 WHERE LOWER(email) = LOWER($1) AND id <> $2`,
                [changes.email, req.employee.id]
            );
            if (duplicateEmail.rows.length) {
                return res.status(409).json({
                    message: "That email address is already used by another employee"
                });
            }
        }

        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `INSERT INTO employee_profile_change_requests
                (employee_id, requested_changes, reason)
             VALUES ($1, $2::jsonb, $3)
             RETURNING id, requested_changes, reason, status, created_at`,
            [req.employee.id, JSON.stringify(changes), reason.trim()]
        );
        await writeAuditLog(client, {
            actorType: "employee",
            actorId: req.employee.id,
            action: "employee.profile_change.requested",
            entityType: "profile_change_request",
            entityId: rows[0].id,
            details: { changes }
        });
        await notifyAdmins(client, {
            title: "Profile change request",
            message: "An employee submitted a profile change request.",
            entityType: "profile_change_request",
            entityId: rows[0].id
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return res.status(201).json({ request: rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(409).json({
                message: "You already have a pending profile change request"
            });
        }
        console.error("Create employee profile change request error:", error);
        return res.status(500).json({ message: "Unable to submit profile change request" });
    } finally {
        if (client) client.release();
    }
}

async function getAdminProfileChangeRequests(req, res) {
    const status = req.query.status;
    if (status && !["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid profile request status filter" });
    }

    try {
        const params = [];
        const where = status ? "WHERE r.status = $1" : "";
        if (status) params.push(status);
        const { rows } = await req.app.locals.pool.query(
            `SELECT r.id, r.employee_id, e.name, e.email, e.department, e.role,
                    r.requested_changes, r.reason, r.status, r.admin_notes,
                    r.created_at, r.reviewed_at
             FROM employee_profile_change_requests r
             JOIN employees e ON e.id = r.employee_id
             ${where}
             ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
                      r.created_at DESC, r.id DESC`,
            params
        );
        return res.json({ requests: rows });
    } catch (error) {
        console.error("Admin profile change request list error:", error);
        return res.status(500).json({ message: "Unable to load profile change requests" });
    }
}

async function reviewAdminProfileChangeRequest(req, res) {
    const id = Number(req.params.id);
    const { status, notes } = req.body || {};
    if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        !["approved", "rejected"].includes(status) ||
        (notes !== undefined && (typeof notes !== "string" || notes.length > 1000))
    ) {
        return res.status(400).json({ message: "Invalid profile change review" });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const result = await client.query(
            `SELECT r.id AS request_id, r.employee_id,
                    r.requested_changes, r.status AS request_status,
                    e.*
             FROM employee_profile_change_requests r
             JOIN employees e ON e.id = r.employee_id
             WHERE r.id = $1
             FOR UPDATE OF r, e`,
            [id]
        );
        const request = result.rows[0];
        if (!request || request.request_status !== "pending") {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(404).json({ message: "Pending profile change request not found" });
        }

        const changes = request.requested_changes;
        if (status === "approved") {
            const validated = validateEmployee({ ...request, ...changes });
            if (Array.isArray(validated)) {
                await client.query("ROLLBACK");
                transactionOpen = false;
                return res.status(409).json({
                    message: "The employee profile is no longer valid for this change"
                });
            }
            await client.query(
                `UPDATE employees
                 SET name = $1, first_name = $2, last_name = $3, email = $4,
                     phone = $5, date_of_birth = $6, gender = $7, address = $8,
                     city = $9, state = $10, country = $11,
                     emergency_contact_name = $12,
                     emergency_contact_relationship = $13,
                     emergency_contact_phone = $14,
                     emergency_contact_email = $15
                 WHERE id = $16`,
                [
                    validated.employee.name,
                    validated.employee.first_name,
                    validated.employee.last_name,
                    validated.employee.email,
                    validated.employee.phone,
                    validated.employee.date_of_birth,
                    validated.employee.gender,
                    validated.employee.address,
                    validated.employee.city,
                    validated.employee.state,
                    validated.employee.country,
                    validated.employee.emergency_contact_name,
                    validated.employee.emergency_contact_relationship,
                    validated.employee.emergency_contact_phone,
                    validated.employee.emergency_contact_email,
                    request.employee_id
                ]
            );
        }

        const updated = await client.query(
            `UPDATE employee_profile_change_requests
             SET status = $1, admin_notes = $2, reviewed_by = $3,
                 reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, employee_id, requested_changes, status,
                       admin_notes, reviewed_at`,
            [status, notes?.trim() || null, req.admin.id, id]
        );
        await writeAuditLog(client, {
            actorType: "admin",
            actorId: req.admin.id,
            action: `admin.profile_change.${status}`,
            entityType: "profile_change_request",
            entityId: id,
            details: { employeeId: request.employee_id, changes, notes: notes?.trim() || null }
        });
        await notifyEmployee(client, {
            employeeId: request.employee_id,
            title: `Profile change request ${status}`,
            message: `Your profile change request was ${status}.`,
            entityType: "profile_change_request",
            entityId: id
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return res.json({ request: updated.rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        if (error.code === "23505") {
            return res.status(409).json({
                message: "The requested email address is already used by another employee"
            });
        }
        console.error("Review employee profile change error:", error);
        return res.status(500).json({ message: "Unable to review profile change request" });
    } finally {
        if (client) client.release();
    }
}

async function getAdminAuditLogs(req, res) {
    const limit = Math.min(100, Math.max(1, parsePage(req.query.limit, 50)));
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, actor_type, actor_id, action, entity_type, entity_id,
                    details, created_at
             FROM hr_audit_logs
             ORDER BY created_at DESC, id DESC
             LIMIT $1`,
            [limit]
        );
        return res.json({ events: rows });
    } catch (error) {
        console.error("Admin audit log error:", error);
        return res.status(500).json({ message: "Unable to load account activity" });
    }
}

async function getEmployeeLeaves(req, res) {
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, start_date, end_date, reason, status,
                    admin_notes, created_at, reviewed_at
             FROM leave_requests
             WHERE employee_id = $1
             ORDER BY created_at DESC, id DESC`,
            [req.employee.id]
        );
        return res.json({ requests: rows });
    } catch (error) {
        console.error("Employee leave request list error:", error);
        return res.status(500).json({ message: "Unable to load leave requests" });
    }
}

async function createEmployeeLeave(req, res) {
    const { startDate, endDate, reason } = req.body || {};
    if (
        !isCalendarDate(startDate) ||
        !isCalendarDate(endDate) ||
        endDate < startDate ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.trim().length > 1000
    ) {
        return res.status(400).json({
            message: "Provide valid leave dates and a reason of at most 1000 characters"
        });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `INSERT INTO leave_requests
                (employee_id, start_date, end_date, reason)
             VALUES ($1, $2, $3, $4)
             RETURNING id, start_date, end_date, reason, status, created_at`,
            [req.employee.id, startDate, endDate, reason.trim()]
        );
        await notifyAdmins(client, {
            title: "New leave request",
            message: "An employee submitted a leave request.",
            entityType: "leave_request",
            entityId: rows[0].id
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return res.status(201).json({ request: rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        console.error("Create leave request error:", error);
        return res.status(500).json({ message: "Unable to submit leave request" });
    } finally {
        if (client) client.release();
    }
}

async function getEmployeeAnnouncements(req, res) {
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, title, body, created_at
             FROM announcements
             WHERE status = 'published'
             ORDER BY created_at DESC, id DESC`
        );
        return res.json({ announcements: rows });
    } catch (error) {
        console.error("Employee announcements error:", error);
        return res.status(500).json({ message: "Unable to load announcements" });
    }
}

async function getAdminLeaves(req, res) {
    const status = req.query.status;
    const allowedStatuses = ["pending", "approved", "rejected"];
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid leave status filter" });
    }

    try {
        const params = [];
        let where = "";
        if (status) {
            params.push(status);
            where = "WHERE lr.status = $1";
        }

        const { rows } = await req.app.locals.pool.query(
            `SELECT lr.id, lr.employee_id, e.name, e.email, e.department,
                    lr.start_date, lr.end_date, lr.reason, lr.status,
                    lr.admin_notes, lr.created_at, lr.reviewed_at
             FROM leave_requests lr
             JOIN employees e ON e.id = lr.employee_id
             ${where}
             ORDER BY CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END,
                      lr.created_at DESC, lr.id DESC`,
            params
        );
        return res.json({ requests: rows });
    } catch (error) {
        console.error("Admin leave request list error:", error);
        return res.status(500).json({ message: "Unable to load leave requests" });
    }
}

async function reviewLeave(req, res) {
    const id = Number(req.params.id);
    const { status, notes } = req.body || {};
    if (
        !Number.isInteger(id) ||
        id <= 0 ||
        !["approved", "rejected"].includes(status) ||
        (notes !== undefined && (typeof notes !== "string" || notes.length > 1000))
    ) {
        return res.status(400).json({ message: "Invalid leave review" });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `UPDATE leave_requests
             SET status = $1,
                 admin_notes = $2,
                 reviewed_by = $3,
                 reviewed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND status = 'pending'
             RETURNING id, employee_id, status, admin_notes, reviewed_at`,
            [status, notes?.trim() || null, req.admin.id, id]
        );
        if (!rows.length) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(404).json({
                message: "Pending leave request not found"
            });
        }
        await notifyEmployee(client, {
            employeeId: rows[0].employee_id,
            title: `Leave request ${status}`,
            message: `Your leave request was ${status}.`,
            entityType: "leave_request",
            entityId: id
        });
        await client.query("COMMIT");
        transactionOpen = false;
        const { employee_id, ...request } = rows[0];
        return res.json({ request });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        console.error("Review leave request error:", error);
        return res.status(500).json({ message: "Unable to review leave request" });
    } finally {
        if (client) client.release();
    }
}

async function getAdminAnnouncements(req, res) {
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, title, body, status, created_at, archived_at
             FROM announcements
             ORDER BY created_at DESC, id DESC`
        );
        return res.json({ announcements: rows });
    } catch (error) {
        console.error("Admin announcements error:", error);
        return res.status(500).json({ message: "Unable to load announcements" });
    }
}

async function publishAnnouncement(req, res) {
    const { title, body } = req.body || {};
    if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 150 ||
        typeof body !== "string" ||
        !body.trim() ||
        body.trim().length > 5000
    ) {
        return res.status(400).json({
            message: "Title (up to 150 characters) and body (up to 5000 characters) are required"
        });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `INSERT INTO announcements (title, body, created_by)
             VALUES ($1, $2, $3)
             RETURNING id, title, body, status, created_at`,
            [title.trim(), body.trim(), req.admin.id]
        );
        await client.query(
            `INSERT INTO hr_notifications
                (recipient_type, recipient_id, title, message, entity_type, entity_id)
             SELECT 'employee', employee_id, 'New announcement', $1,
                    'announcement', $2
             FROM employee_accounts
             WHERE status = 'active'`,
            [title.trim(), rows[0].id]
        );
        await client.query("COMMIT");
        transactionOpen = false;
        return res.status(201).json({ announcement: rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        console.error("Publish announcement error:", error);
        return res.status(500).json({ message: "Unable to publish announcement" });
    } finally {
        if (client) client.release();
    }
}

async function archiveAnnouncement(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid announcement ID" });
    }

    try {
        const { rows } = await req.app.locals.pool.query(
            `UPDATE announcements
             SET status = 'archived',
                 archived_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND status = 'published'
             RETURNING id, status, archived_at`,
            [id]
        );
        if (!rows.length) {
            return res.status(404).json({ message: "Published announcement not found" });
        }
        return res.json({ announcement: rows[0] });
    } catch (error) {
        console.error("Archive announcement error:", error);
        return res.status(500).json({ message: "Unable to archive announcement" });
    }
}

async function getAdminAttendance(req, res) {
    const date = req.query.date;
    if (!isCalendarDate(date)) {
        return res.status(400).json({ message: "A valid attendance date is required" });
    }

    const page = parsePage(req.query.page);
    const limit = Math.min(100, Math.max(1, parsePage(req.query.limit, 25)));
    const offset = (page - 1) * limit;

    try {
        const [countResult, attendanceResult] = await Promise.all([
            req.app.locals.pool.query(
                "SELECT COUNT(*)::int AS total FROM employees WHERE created_at::date <= $1::date",
                [date]
            ),
            req.app.locals.pool.query(
                `SELECT a.id, e.id AS employee_id, e.name, e.email, e.department,
                        $1::date::text AS attendance_date,
                        a.check_in, a.check_out,
                        a.total_working_minutes,
                        CASE WHEN a.status = 'incomplete' THEN 'present'
                             ELSE COALESCE(a.status, 'absent')
                        END AS status
                 FROM employees e
                 LEFT JOIN attendance a
                   ON a.employee_id = e.id AND a.attendance_date = $1
                 WHERE e.created_at::date <= $1::date
                 ORDER BY e.name, e.id
                 LIMIT $2 OFFSET $3`,
                [date, limit, offset]
            )
        ]);
        const total = countResult.rows[0].total;
        return res.json({
            attendance: attendanceResult.rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error("Admin attendance list error:", error);
        return res.status(500).json({ message: "Unable to load attendance records" });
    }
}

async function saveAttendance(req, res) {
    const body = req.body || {};
    const { employeeId, attendanceDate, checkIn, checkOut, status } = body;
    const validStatuses = new Set(["present", "late", "absent", "leave", "holiday"]);
    if (
        !Number.isSafeInteger(employeeId) ||
        employeeId <= 0 ||
        !isCalendarDate(attendanceDate) ||
        !validStatuses.has(status) ||
        (checkIn !== null && !isLocalDateTime(checkIn)) ||
        (checkOut !== null && !isLocalDateTime(checkOut)) ||
        (checkOut && !checkIn) ||
        (checkIn && checkOut && checkOut < checkIn) ||
        ((status === "present" || status === "late") && !checkIn) ||
        (["absent", "leave", "holiday"].includes(status) && (checkIn || checkOut)) ||
        (checkIn && checkIn.slice(0, 10) !== attendanceDate) ||
        (checkOut && checkOut.slice(0, 10) !== attendanceDate)
    ) {
        return res.status(400).json({ message: "Invalid attendance status or times" });
    }

    try {
        const { rows } = await req.app.locals.pool.query(
            `INSERT INTO attendance
                (employee_id, attendance_date, check_in, check_out,
                 total_working_minutes, status)
             VALUES (
                 $1, $2, $3::timestamp AT TIME ZONE $6,
                 $4::timestamp AT TIME ZONE $6,
                 CASE WHEN $3::timestamp IS NOT NULL AND $4::timestamp IS NOT NULL
                      THEN FLOOR(EXTRACT(EPOCH FROM (
                          ($4::timestamp AT TIME ZONE $6) -
                          ($3::timestamp AT TIME ZONE $6)
                      )) / 60)::INTEGER
                      ELSE NULL
                 END,
                 $5
             )
             ON CONFLICT (employee_id, attendance_date)
             DO UPDATE SET
                 check_in = EXCLUDED.check_in,
                 check_out = EXCLUDED.check_out,
                 total_working_minutes = EXCLUDED.total_working_minutes,
                 status = EXCLUDED.status,
                 updated_at = CURRENT_TIMESTAMP
             RETURNING id, employee_id, attendance_date::text AS attendance_date,
                       check_in, check_out, total_working_minutes, status`,
            [employeeId, attendanceDate, checkIn, checkOut, status, TIMEZONE]
        );
        return res.json({ attendance: rows[0] });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(404).json({ message: "Employee not found" });
        }
        console.error("Save attendance error:", error);
        return res.status(500).json({ message: "Unable to save attendance status" });
    }
}

async function correctAttendance(req, res) {
    const id = Number(req.params.id);
    const { checkIn, checkOut } = req.body || {};
    if (
        !Number.isInteger(id) ||
        id <= 0 ||
        (checkIn !== null && !isLocalDateTime(checkIn)) ||
        (checkOut !== null && !isLocalDateTime(checkOut)) ||
        (!checkIn && checkOut)
    ) {
        return res.status(400).json({ message: "Invalid attendance correction" });
    }

    try {
        const pool = req.app.locals.pool;
        const existing = await pool.query(
            "SELECT attendance_date::text AS attendance_date FROM attendance WHERE id = $1",
            [id]
        );
        if (!existing.rows.length) {
            return res.status(404).json({ message: "Attendance record not found" });
        }

        const attendanceDate = existing.rows[0].attendance_date;
        if (
            (checkIn && checkIn.slice(0, 10) !== attendanceDate) ||
            (checkOut && checkOut.slice(0, 10) !== attendanceDate)
        ) {
            return res.status(400).json({
                message: "Corrected times must remain on the attendance date"
            });
        }

        if (checkIn && checkOut && checkOut < checkIn) {
            return res.status(400).json({ message: "Check-out cannot precede check-in" });
        }

        const { rows } = await pool.query(
            `UPDATE attendance
             SET check_in = $1::timestamp AT TIME ZONE $3,
                 check_out = $2::timestamp AT TIME ZONE $3,
                 total_working_minutes = CASE
                     WHEN $1::timestamp IS NOT NULL AND $2::timestamp IS NOT NULL
                     THEN FLOOR(EXTRACT(EPOCH FROM (
                         ($2::timestamp AT TIME ZONE $3) -
                         ($1::timestamp AT TIME ZONE $3)
                     )) / 60)::INTEGER
                     ELSE NULL
                 END,
                 status = CASE
                     WHEN $1::timestamp IS NULL THEN 'absent'
                     WHEN $2::timestamp IS NOT NULL THEN 'present'
                     ELSE 'incomplete'
                 END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING id, employee_id, attendance_date::text AS attendance_date,
                       check_in, check_out,
                       total_working_minutes, status`,
            [checkIn, checkOut, TIMEZONE, id]
        );
        return res.json({ attendance: rows[0] });
    } catch (error) {
        console.error("Correct attendance error:", error);
        return res.status(500).json({ message: "Unable to correct attendance record" });
    }
}

module.exports = {
    getNotifications,
    markNotificationRead,
    getEmployeeLeaves,
    getEmployeeProfileChangeRequests,
    createEmployeeProfileChangeRequest,
    createEmployeeLeave,
    getEmployeeAnnouncements,
    getAdminLeaves,
    getAdminProfileChangeRequests,
    reviewAdminProfileChangeRequest,
    getAdminAuditLogs,
    reviewLeave,
    getAdminAnnouncements,
    publishAnnouncement,
    archiveAnnouncement,
    getAdminAttendance,
    saveAttendance,
    correctAttendance,
    isCalendarDate,
    isLocalDateTime,
    csvCell,
    writeAuditLog
};
