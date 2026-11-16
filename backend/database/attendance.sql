CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL
        REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    total_working_minutes INTEGER
        CHECK (total_working_minutes IS NULL OR total_working_minutes >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'incomplete'
        CHECK (status IN ('incomplete', 'present', 'late', 'absent', 'leave', 'holiday')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_one_record_per_day
        UNIQUE (employee_id, attendance_date),
    CONSTRAINT attendance_valid_times
        CHECK (
            (check_in IS NULL AND check_out IS NULL)
            OR (
                check_in IS NOT NULL
                AND (check_out IS NULL OR check_out >= check_in)
            )
        ),
    CONSTRAINT attendance_status_matches_check_out
        CHECK (
            (status = 'incomplete' AND check_in IS NOT NULL AND check_out IS NULL)
            OR (status IN ('present', 'late') AND check_in IS NOT NULL)
            OR (status IN ('absent', 'leave', 'holiday')
                AND check_in IS NULL AND check_out IS NULL)
        )
);

ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance
    DROP CONSTRAINT IF EXISTS attendance_status_matches_check_out;
UPDATE attendance
SET status = 'absent'
WHERE status = 'incomplete' AND check_in IS NULL;
ALTER TABLE attendance
    ADD CONSTRAINT attendance_status_check
        CHECK (status IN ('incomplete', 'present', 'late', 'absent', 'leave', 'holiday'));
ALTER TABLE attendance
    ADD CONSTRAINT attendance_status_matches_check_out
        CHECK (
            (status = 'incomplete' AND check_in IS NOT NULL AND check_out IS NULL)
            OR (status IN ('present', 'late') AND check_in IS NOT NULL)
            OR (status IN ('absent', 'leave', 'holiday')
                AND check_in IS NULL AND check_out IS NULL)
        );
