const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const validateEmployee = require("../utils/employeeValidation");
const { authenticateAdmin } = require("../middleware/adminAuthMiddleware");
const { authenticateEmployee } = require("../middleware/employeeAuthMiddleware");
const { changeAdminPassword } = require("../controllers/adminAuthController");
const {
    createEmployeeAccount,
    generateEmployeePassword
} = require("../controllers/employeeAuthController");
const {
    isCalendarDate,
    isLocalDateTime,
    csvCell,
    getNotifications,
    markNotificationRead,
    createEmployeeLeave,
    reviewLeave,
    saveAttendance,
    correctAttendance,
    createEmployeeProfileChangeRequest,
    reviewAdminProfileChangeRequest
} = require("../controllers/hrController");
const employeeAuthRoutes = require("../routes/employeeAuthRoutes");
const { getEmployeeDocument } = require("../controllers/employeeDocumentsController");
const bcrypt = require("bcrypt");

process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";

function responseMock() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function bearerToken(payload) {
    return `Bearer ${jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" })}`;
}

test("employee validation normalizes input and rejects invalid records", () => {
    const result = validateEmployee({
        name: "  Alex Doe ",
        email: "  ALEX@example.com ",
        role: " Engineer ",
        department: " IT "
    });

    assert.equal(result.employee.name, "Alex Doe");
    assert.equal(result.employee.first_name, "Alex");
    assert.equal(result.employee.last_name, "Doe");
    assert.equal(result.employee.email, "alex@example.com");
    assert.equal(result.employee.status, "active");
    assert.equal(result.employee.annual_leave_entitlement, 0);
    assert.ok(Array.isArray(validateEmployee({
        name: "Alex Doe",
        email: "alex@example.com",
        role: "Engineer",
        department: "IT",
        status: "retired"
    })));
    assert.ok(Array.isArray(validateEmployee(null)));
    assert.ok(Array.isArray(validateEmployee({ name: "Bad email", email: "invalid", role: "Dev", department: "IT" })));
});

test("employee validation accepts expanded HR fields and rejects invalid dates or types", () => {
    const result = validateEmployee({
        first_name: " Sam ",
        last_name: "Lee",
        email: "sam@example.com",
        role: "Engineer",
        department: "Platform",
        phone: "+1 (555) 123-4567",
        date_of_birth: "1992-02-29",
        gender: "prefer_not_to_say",
        employment_type: "contract",
        joining_date: "2025-01-15",
        manager_id: "8",
        address: "  10 Main Street ",
        annual_leave_entitlement: "15.5"
    });

    assert.equal(result.employee.name, "Sam Lee");
    assert.equal(result.employee.manager_id, 8);
    assert.equal(result.employee.address, "10 Main Street");
    assert.equal(result.employee.annual_leave_entitlement, 15.5);
    assert.ok(Array.isArray(validateEmployee({
        first_name: "Sam",
        email: "sam@example.com",
        role: "Engineer",
        department: "Platform",
        date_of_birth: "1992-02-30"
    })));
    assert.ok(Array.isArray(validateEmployee({
        first_name: "Sam",
        email: "sam@example.com",
        role: "Engineer",
        department: "Platform",
        employment_type: "permanent"
    })));
});

test("admin middleware rejects employee, inactive, and stale tokens", async () => {
    const employeeResponse = responseMock();
    await authenticateAdmin(
        {
            headers: { authorization: bearerToken({ id: 8, role: "employee", authVersion: 0 }) },
            app: { locals: { pool: { query: async () => assert.fail("employee token must not query admin") } } }
        },
        employeeResponse,
        () => assert.fail("employee token must not pass")
    );
    assert.equal(employeeResponse.statusCode, 403);

    const makeRequest = (account, authVersion = 2) => ({
        headers: { authorization: bearerToken({ id: 1, role: "admin", authVersion }) },
        app: { locals: { pool: { query: async () => ({ rows: account ? [account] : [] }) } } }
    });

    const adminResponse = responseMock();
    let passed = false;
    await authenticateAdmin(
        makeRequest({ status: "active", auth_version: 2 }),
        adminResponse,
        () => { passed = true; }
    );
    assert.equal(passed, true);

    const staleResponse = responseMock();
    await authenticateAdmin(
        makeRequest({ status: "active", auth_version: 1 }),
        staleResponse,
        () => assert.fail("stale administrator token must not pass")
    );
    assert.equal(staleResponse.statusCode, 401);

    const inactiveResponse = responseMock();
    await authenticateAdmin(
        makeRequest({ status: "inactive", auth_version: 2 }),
        inactiveResponse,
        () => assert.fail("inactive administrator must not pass")
    );
    assert.equal(inactiveResponse.statusCode, 401);
});

test("employee auth routes do not expose administrator account management", () => {
    const paths = employeeAuthRoutes.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);
    assert.deepEqual(paths, ["/login", "/change-password"]);
});

test("inactive employees cannot be given new login credentials", async () => {
    const pool = {
        async query() {
            return { rows: [{ id: 5, name: "Alex Doe", email: "alex@example.com", status: "inactive" }] };
        }
    };
    const req = {
        params: { employeeId: "5" },
        body: { employeeId: 5, temporaryPassword: "temporary-password-123" },
        app: { locals: { pool } }
    };

    for (const controller of [createEmployeeAccount, generateEmployeePassword]) {
        const res = responseMock();
        await controller(req, res);
        assert.equal(res.statusCode, 409);
        assert.match(res.body.message, /inactive employee/);
    }
});

test("missing private documents return a JSON 404 response", async () => {
    const req = {
        employee: { id: 3 },
        params: { documentId: "8" },
        query: { preview: "1" },
        app: {
            locals: {
                pool: {
                    async query() {
                        return {
                            rows: [{
                                storage_name: "document.pdf",
                                original_name: "offer.pdf",
                                mime_type: "application/pdf"
                            }]
                        };
                    }
                }
            }
        }
    };
    const res = Object.assign(responseMock(), {
        headersSent: false,
        setHeader() {},
        type() { return this; },
        sendFile(_filePath, callback) {
            callback(Object.assign(new Error("not found"), { code: "ENOENT" }));
            return this;
        }
    });

    await getEmployeeDocument(req, res, error => { throw error; });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { message: "Stored document file is unavailable" });
});

test("employee middleware enforces account version and temporary password change", async () => {
    const token = bearerToken({
        id: 5,
        role: "employee",
        authVersion: 3,
        mustChangePassword: true
    });
    const account = { status: "active", auth_version: 3, must_change_password: true };
    const req = {
        headers: { authorization: token },
        path: "/attendance",
        app: { locals: { pool: { query: async () => ({ rows: [account] }) } } }
    };
    const denied = responseMock();
    await authenticateEmployee(req, denied, () => assert.fail("temporary token must be restricted"));
    assert.equal(denied.statusCode, 403);

    req.path = "/change-password";
    const allowed = responseMock();
    let passed = false;
    await authenticateEmployee(req, allowed, () => { passed = true; });
    assert.equal(passed, true);

    req.path = "/attendance";
    req.app.locals.pool.query = async () => ({
        rows: [{ ...account, auth_version: 4 }]
    });
    const stale = responseMock();
    await authenticateEmployee(req, stale, () => assert.fail("stale token must not pass"));
    assert.equal(stale.statusCode, 401);
});

test("date validation and CSV escaping handle invalid dates and formulas", () => {
    assert.equal(isCalendarDate("2026-02-28"), true);
    assert.equal(isCalendarDate("2026-02-30"), false);
    assert.equal(isLocalDateTime("2026-02-28T23:59"), true);
    assert.equal(isLocalDateTime("2026-02-28T24:00"), false);
    assert.equal(isLocalDateTime("2026-02-30T12:00"), false);
    assert.equal(csvCell('=CMD("x")'), "\"'=CMD(\"\"x\"\")\"");
    assert.equal(csvCell('Alex "A" Doe'), "\"Alex \"\"A\"\" Doe\"");
});

test("notification reads and updates are scoped to the authenticated recipient", async () => {
    const queries = [];
    const pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            return sql.includes("COUNT(*)")
                ? { rows: [{ count: 2 }] }
                : { rows: [{ id: 8, title: "Test", read_at: null }] };
        }
    };
    const req = {
        employee: { id: 9 },
        admin: { id: 1 },
        app: { locals: { pool } }
    };
    const listResponse = responseMock();
    await getNotifications(req, listResponse);

    assert.equal(listResponse.body.unreadCount, 2);
    assert.deepEqual(queries.map(query => query.params), [
        ["employee", 9],
        ["employee", 9]
    ]);

    const updateResponse = responseMock();
    await markNotificationRead({
        ...req,
        body: { id: "8" }
    }, updateResponse);
    assert.deepEqual(queries[2].params, ["employee", 9, 8]);
    assert.match(queries[2].sql, /recipient_type = \$1 AND recipient_id = \$2/);

    const invalidResponse = responseMock();
    await markNotificationRead({
        ...req,
        body: { id: 0 }
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
});

test("leave request submission and review create role-scoped notifications", async () => {
    const createQueries = [];
    let createReleased = false;
    const createClient = {
        async query(sql, params) {
            createQueries.push({ sql, params });
            if (sql.includes("INSERT INTO leave_requests")) {
                return { rows: [{ id: 6, status: "pending" }] };
            }
            return { rows: [] };
        },
        release() { createReleased = true; }
    };
    const createResponse = responseMock();
    await createEmployeeLeave({
        employee: { id: 3 },
        body: { startDate: "2026-12-01", endDate: "2026-12-02", reason: "Personal" },
        app: { locals: { pool: { connect: async () => createClient } } }
    }, createResponse);

    assert.equal(createResponse.statusCode, 201);
    assert.ok(createQueries.some(query =>
        query.sql.includes("SELECT 'admin', id") &&
        query.params[2] === "leave_request"
    ));
    assert.ok(createQueries.some(query => query.sql === "COMMIT"));
    assert.equal(createReleased, true);

    const reviewQueries = [];
    const reviewClient = {
        async query(sql, params) {
            reviewQueries.push({ sql, params });
            if (sql.includes("UPDATE leave_requests")) {
                return {
                    rows: [{ id: 6, employee_id: 3, status: "approved", admin_notes: null }]
                };
            }
            return { rows: [] };
        },
        release() {}
    };
    const reviewResponse = responseMock();
    await reviewLeave({
        params: { id: "6" },
        body: { status: "approved" },
        admin: { id: 1 },
        app: { locals: { pool: { connect: async () => reviewClient } } }
    }, reviewResponse);

    assert.equal(reviewResponse.statusCode, 200);
    assert.ok(reviewQueries.some(query =>
        query.sql.includes("SELECT 'employee', employee_id") &&
        query.params.includes(3)
    ));
    assert.ok(reviewQueries.some(query =>
        query.sql.includes("$3::text <> 'leave_request'")
    ));
    assert.ok(reviewQueries.some(query => query.sql === "COMMIT"));
});

test("attendance status saves validate status and upsert the employee-day record", async () => {
    let queryCount = 0;
    const pool = {
        async query(sql, params) {
            queryCount += 1;
            assert.match(sql, /ON CONFLICT \(employee_id, attendance_date\)/);
            assert.deepEqual(params.slice(0, 5), [
                7,
                "2026-11-12",
                "2026-11-12T09:00",
                null,
                "late"
            ]);
            return { rows: [{ id: 21, employee_id: 7, status: "late" }] };
        }
    };
    const req = {
        body: {
            employeeId: 7,
            attendanceDate: "2026-11-12",
            checkIn: "2026-11-12T09:00",
            checkOut: null,
            status: "late"
        },
        app: { locals: { pool } }
    };
    const res = responseMock();

    await saveAttendance(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(queryCount, 1);
    assert.equal(res.body.attendance.status, "late");

    const invalidResponse = responseMock();
    await saveAttendance({
        ...req,
        body: { ...req.body, status: "incomplete" }
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(queryCount, 1);
});

test("attendance correction compares against a database calendar-date string", async () => {
    const queries = [];
    const pool = {
        async query(sql) {
            queries.push(sql);
            return queries.length === 1
                ? { rows: [{ attendance_date: "2026-11-12" }] }
                : { rows: [{ id: 4, attendance_date: "2026-11-12" }] };
        }
    };
    const req = {
        params: { id: "4" },
        body: {
            checkIn: "2026-11-12T09:00",
            checkOut: "2026-11-12T17:00"
        },
        app: { locals: { pool } }
    };
    const res = responseMock();

    await correctAttendance(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(queries[0], /attendance_date::text AS attendance_date/);
    assert.match(queries[1], /AT TIME ZONE/);
});

test("profile change requests validate fields and persist a normalized audit event", async () => {
    let queries = [];
    let released = false;
    const client = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes("SELECT * FROM employees")) {
                return { rows: [{ id: 3, name: "Alex Doe", email: "alex@example.com", role: "Dev", department: "IT" }] };
            }
            if (sql.includes("INSERT INTO employee_profile_change_requests")) {
                return { rows: [{ id: 11, requested_changes: JSON.parse(params[1]), status: "pending" }] };
            }
            return { rows: [] };
        },
        release() { released = true; }
    };
    const req = {
        employee: { id: 3 },
        body: { changes: { name: " Alex Smith ", email: "ALEX.SMITH@example.com" }, reason: "My details changed" },
        app: { locals: { pool: { connect: async () => client } } }
    };
    const res = responseMock();

    await createEmployeeProfileChangeRequest(req, res);

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.body.request.requested_changes, {
        first_name: "Alex",
        last_name: "Smith",
        email: "alex.smith@example.com"
    });
    assert.ok(queries.some(item => item.sql.includes("INSERT INTO hr_audit_logs")));
    assert.ok(queries.some(item => item.sql.includes("SELECT 'admin', id")));
    assert.ok(released);

    const invalidResponse = responseMock();
    await createEmployeeProfileChangeRequest({
        ...req,
        body: { changes: { isAdmin: true }, reason: "Invalid" }
    }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);
});

test("admin approval applies a profile change and records the review atomically", async () => {
    const queries = [];
    const client = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes("SELECT r.id AS request_id")) {
                return {
                    rows: [{
                        request_id: 11,
                        employee_id: 3,
                        requested_changes: { email: "alex.new@example.com" },
                        request_status: "pending",
                        id: 3,
                        name: "Alex Doe",
                        email: "alex@example.com",
                        role: "Dev",
                        department: "IT"
                    }]
                };
            }
            if (sql.includes("UPDATE employee_profile_change_requests")) {
                return { rows: [{ id: 11, employee_id: 3, status: "approved" }] };
            }
            return { rows: [] };
        },
        release() {}
    };
    const req = {
        params: { id: "11" },
        body: { status: "approved", notes: "Verified" },
        admin: { id: 1 },
        app: { locals: { pool: { connect: async () => client } } }
    };
    const res = responseMock();

    await reviewAdminProfileChangeRequest(req, res);

    assert.equal(res.statusCode, 200);
    const employeeUpdate = queries.find(item => item.sql.includes("UPDATE employees"));
    assert.equal(employeeUpdate.params[0], "Alex Doe");
    assert.equal(employeeUpdate.params[3], "alex.new@example.com");
    assert.equal(employeeUpdate.params[15], 3);
    assert.ok(queries.some(item => item.sql.includes("INSERT INTO hr_audit_logs")));
    assert.ok(queries.some(item => item.sql === "COMMIT"));
});

test("admin password change rotates the versioned session and records an audit event", async () => {
    const originalHash = await bcrypt.hash("old-password-123", 4);
    const queries = [];
    const client = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.includes("SELECT id, username, password_hash")) {
                return {
                    rows: [{
                        id: 1,
                        username: "admin",
                        password_hash: originalHash,
                        auth_version: 2,
                        status: "active"
                    }]
                };
            }
            if (sql.includes("UPDATE admins")) {
                return {
                    rows: [{ id: 1, username: "admin", role: "admin", auth_version: 3 }]
                };
            }
            return { rows: [] };
        },
        release() {}
    };
    const req = {
        admin: { id: 1 },
        body: { currentPassword: "old-password-123", newPassword: "new-password-456" },
        app: { locals: { pool: { connect: async () => client } } }
    };
    const res = responseMock();

    await changeAdminPassword(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).authVersion, 3);
    assert.ok(queries.some(item => item.sql.includes("INSERT INTO hr_audit_logs")));
    assert.ok(res.body.sessionExpiresAt);
});
