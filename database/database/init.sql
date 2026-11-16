
-- Create employee table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_leave', 'inactive', 'terminated')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_leave', 'inactive', 'terminated'));

-- Insert sample employees
INSERT INTO employees (name, email, role, department)
VALUES
    ('Karthik', 'karthik@example.com', 'DevOps Engineer', 'IT'),
    ('Rahul', 'rahul@example.com', 'Developer', 'Development'),
    ('Arun', 'arun@example.com', 'Cloud Engineer', 'Cloud')
ON CONFLICT (email) DO NOTHING;
