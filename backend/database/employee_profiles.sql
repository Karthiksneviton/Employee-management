ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS employee_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(30),
    ADD COLUMN IF NOT EXISTS profile_photo_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS address VARCHAR(500),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100),
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS joining_date DATE,
    ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS work_location VARCHAR(150),
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30),
    ADD COLUMN IF NOT EXISTS emergency_contact_email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS annual_leave_entitlement NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (annual_leave_entitlement >= 0 AND annual_leave_entitlement <= 365);

UPDATE employees
SET first_name = split_part(name, ' ', 1),
    last_name = CASE
        WHEN position(' ' IN name) > 0
        THEN substring(name FROM position(' ' IN name) + 1)
        ELSE ''
    END
WHERE first_name IS NULL OR last_name IS NULL;

UPDATE employees
SET employee_code = 'EMP-' || lpad(id::text, 5, '0')
WHERE employee_code IS NULL;

ALTER TABLE employees
    ALTER COLUMN employee_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_idx
    ON employees (employee_code);

CREATE OR REPLACE FUNCTION set_employee_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.employee_code IS NULL THEN
        NEW.employee_code := 'EMP-' || lpad(NEW.id::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employees_set_employee_code ON employees;
CREATE TRIGGER employees_set_employee_code
    BEFORE INSERT ON employees
    FOR EACH ROW
    EXECUTE FUNCTION set_employee_code();

CREATE INDEX IF NOT EXISTS employees_manager_idx ON employees (manager_id);

CREATE TABLE IF NOT EXISTS employee_documents (
    id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(40) NOT NULL
        CHECK (document_type IN (
            'offer_letter', 'joining_letter', 'employment_contract', 'id_proof',
            'address_proof', 'certificate', 'experience_letter', 'payslip', 'other'
        )),
    original_name VARCHAR(255) NOT NULL,
    storage_name VARCHAR(100) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL
        CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    expires_at DATE,
    uploaded_by_type VARCHAR(20) NOT NULL
        CHECK (uploaded_by_type IN ('admin', 'employee')),
    uploaded_by_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS employee_documents_employee_created_idx
    ON employee_documents (employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_preferences (
    employee_id INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    leave_updates BOOLEAN NOT NULL DEFAULT TRUE,
    announcements BOOLEAN NOT NULL DEFAULT TRUE,
    attendance_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    time_zone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    theme VARCHAR(20) NOT NULL DEFAULT 'system'
        CHECK (theme IN ('light', 'dark', 'system')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_login_activity (
    id BIGSERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS employee_login_activity_employee_created_idx
    ON employee_login_activity (employee_id, created_at DESC);
