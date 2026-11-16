
CREATE TABLE IF NOT EXISTS employee_accounts (
    id SERIAL PRIMARY KEY,

    employee_id INTEGER NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),

    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    auth_version INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_employee_account
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
);

ALTER TABLE employee_accounts
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE employee_accounts
    ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
