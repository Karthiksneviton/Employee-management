
const TIMEZONE = "Asia/Kolkata";

// Get today's attendance
async function getTodayAttendance(pool, employeeId) {

    const result = await pool.query(
        `SELECT
            id,
            employee_id,
            attendance_date::text AS attendance_date,
            check_in,
            check_out,
            total_working_minutes,
            status
         FROM attendance
         WHERE employee_id = $1
         AND attendance_date =
             (CURRENT_TIMESTAMP AT TIME ZONE $2)::date`,
        [employeeId, TIMEZONE]
    );

    return result.rows[0] || null;
}


// Employee check-in
async function checkIn(pool, employeeId) {

    const result = await pool.query(
        `INSERT INTO attendance (
            employee_id,
            attendance_date,
            check_in,
            status
        )
        VALUES (
            $1,
            (CURRENT_TIMESTAMP AT TIME ZONE $2)::date,
            CURRENT_TIMESTAMP,
            'incomplete'
        )
        ON CONFLICT (employee_id, attendance_date)
        DO NOTHING
        RETURNING id, employee_id, attendance_date::text AS attendance_date,
                  check_in, check_out, total_working_minutes, status`,
        [employeeId, TIMEZONE]
    );

    return result.rows[0] || null;
}


// Employee check-out
async function checkOut(pool, employeeId) {

    const result = await pool.query(
        `UPDATE attendance
         SET
            check_out = CURRENT_TIMESTAMP,

            total_working_minutes =
                FLOOR(
                    EXTRACT(
                        EPOCH FROM (
                            CURRENT_TIMESTAMP - check_in
                        )
                    ) / 60
                )::INTEGER,

            status = CASE WHEN status = 'late' THEN 'late' ELSE 'present' END,

            updated_at = CURRENT_TIMESTAMP

         WHERE id = (
             SELECT id
             FROM attendance
             WHERE employee_id = $1
             AND attendance_date =
                 (CURRENT_TIMESTAMP AT TIME ZONE $2)::date
             AND check_out IS NULL
             AND check_in IS NOT NULL
             ORDER BY check_in DESC
             LIMIT 1
         )

         AND check_out IS NULL

         RETURNING id, employee_id, attendance_date::text AS attendance_date,
                   check_in, check_out, total_working_minutes, status`,
        [employeeId, TIMEZONE]
    );

    return result.rows[0] || null;
}


// Attendance history
async function getAttendanceHistory(pool, employeeId, limit, offset) {

    const result = await pool.query(
        `SELECT
            id,
            attendance_date::text AS attendance_date,
            check_in,
            check_out,
            total_working_minutes,
            status

         FROM attendance

         WHERE employee_id = $1

         ORDER BY attendance_date DESC

         LIMIT $2 OFFSET $3`,
        [employeeId, limit, offset]
    );

    return result.rows;
}


// Total attendance count
async function getAttendanceCount(pool, employeeId) {

    const result = await pool.query(
        `SELECT COUNT(*)::INTEGER AS total
         FROM attendance
         WHERE employee_id = $1`,
        [employeeId]
    );

    return result.rows[0].total;
}


module.exports = {
    getTodayAttendance,
    checkIn,
    checkOut,
    getAttendanceHistory,
    getAttendanceCount
};
