const { writeAuditLog } = require("./hrController");

async function updateEmployeePreferences(req, res) {
    const {
        emailNotifications,
        leaveUpdates,
        announcements,
        attendanceAlerts,
        language,
        timeZone,
        theme
    } = req.body || {};

    if (
        typeof emailNotifications !== "boolean" ||
        typeof leaveUpdates !== "boolean" ||
        typeof announcements !== "boolean" ||
        typeof attendanceAlerts !== "boolean" ||
        typeof language !== "string" ||
        !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language) ||
        typeof timeZone !== "string" ||
        timeZone.length > 100 ||
        !["light", "dark", "system"].includes(theme)
    ) {
        return res.status(400).json({ message: "Provide valid account preferences" });
    }

    try {
        new Intl.DateTimeFormat("en", { timeZone });
    } catch {
        return res.status(400).json({ message: "Select a valid time zone" });
    }

    let client;
    let transactionOpen = false;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `INSERT INTO employee_preferences
                (employee_id, email_notifications, leave_updates, announcements,
                 attendance_alerts, language, time_zone, theme, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
             ON CONFLICT (employee_id)
             DO UPDATE SET
                email_notifications = EXCLUDED.email_notifications,
                leave_updates = EXCLUDED.leave_updates,
                announcements = EXCLUDED.announcements,
                attendance_alerts = EXCLUDED.attendance_alerts,
                language = EXCLUDED.language,
                time_zone = EXCLUDED.time_zone,
                theme = EXCLUDED.theme,
                updated_at = CURRENT_TIMESTAMP
             RETURNING email_notifications, leave_updates, announcements,
                       attendance_alerts, language, time_zone, theme`,
            [
                req.employee.id,
                emailNotifications,
                leaveUpdates,
                announcements,
                attendanceAlerts,
                language,
                timeZone,
                theme
            ]
        );
        await writeAuditLog(client, {
            actorType: "employee",
            actorId: req.employee.id,
            action: "employee.preferences.updated",
            entityType: "employee_preferences",
            entityId: req.employee.id,
            details: { language, timeZone, theme }
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return res.json({ preferences: rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        console.error("Update employee preferences error:", error);
        return res.status(500).json({ message: "Unable to update account preferences" });
    } finally {
        if (client) client.release();
    }
}

module.exports = { updateEmployeePreferences };
