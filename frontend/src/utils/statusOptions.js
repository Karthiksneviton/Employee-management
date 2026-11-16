export const EMPLOYEE_STATUSES = [
    { value: "active", label: "🟢 Active" },
    { value: "on_leave", label: "🟡 On Leave" },
    { value: "inactive", label: "⚪ Inactive" },
    { value: "terminated", label: "🔴 Terminated" }
];

export const ATTENDANCE_STATUSES = [
    { value: "present", label: "🟢 Present" },
    { value: "late", label: "🟡 Late" },
    { value: "absent", label: "🔴 Absent" },
    { value: "leave", label: "🔵 Leave" },
    { value: "holiday", label: "⚪ Holiday" }
];

export function getStatusLabel(options, value) {
    return options.find(option => option.value === value)?.label || value;
}
