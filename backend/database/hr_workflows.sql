CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    admin_notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

ALTER TABLE leave_requests
    ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_notes VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS leave_requests_employee_created_idx
    ON leave_requests (employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_requests_status_created_idx
    ON leave_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    body VARCHAR(5000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'archived')),
    created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS announcements_status_created_idx
    ON announcements (status, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_profile_change_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    requested_changes JSONB NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    admin_notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS profile_change_requests_status_created_idx
    ON employee_profile_change_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_change_requests_employee_created_idx
    ON employee_profile_change_requests (employee_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS profile_change_requests_one_pending_per_employee_idx
    ON employee_profile_change_requests (employee_id)
    WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS hr_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_type VARCHAR(20) NOT NULL
        CHECK (actor_type IN ('admin', 'employee', 'system')),
    actor_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS hr_audit_logs_created_idx
    ON hr_audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS hr_notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL
        CHECK (recipient_type IN ('admin', 'employee')),
    recipient_id INTEGER NOT NULL,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS hr_notifications_recipient_created_idx
    ON hr_notifications (recipient_type, recipient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS hr_notifications_unread_idx
    ON hr_notifications (recipient_type, recipient_id)
    WHERE read_at IS NULL;
