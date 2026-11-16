
// Create employee login account
async function createEmployeeAccount(pool, employeeId, passwordHash) {
    const result = await pool.query(
        `INSERT INTO employee_accounts
            (employee_id, password_hash, status, must_change_password)
         VALUES ($1, $2, 'active', TRUE)
         RETURNING id, employee_id, status, created_at`,
        [employeeId, passwordHash]
    );

    return result.rows[0];
}

// Find employee account using email
async function findEmployeeAccountByEmail(pool, email) {
    const result = await pool.query(
        `SELECT
            ea.id AS account_id,
            ea.employee_id,
            ea.password_hash,
            ea.status,
            ea.must_change_password,
            ea.auth_version,
            e.name,
            e.email,
            e.role,
            e.department,
            e.status AS employee_status
         FROM employee_accounts ea
         INNER JOIN employees e
            ON e.id = ea.employee_id
         WHERE LOWER(e.email) = LOWER($1)
         LIMIT 1`,
        [email]
    );

    return result.rows[0] || null;
}

module.exports = {
    createEmployeeAccount,
    findEmployeeAccountByEmail
};
