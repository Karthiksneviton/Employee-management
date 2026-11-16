async function request(path, { employee = false, ...options } = {}) {
    const token = sessionStorage.getItem(
        employee ? "employee_token" : "admin_token"
    );
    if (!token) {
        throw new Error("Please sign in again to continue");
    }

    const response = await fetch(`/api/${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...options.headers
        }
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response");
    }

    if (!response.ok) {
        if (!employee && (response.status === 401 || response.status === 403)) {
            sessionStorage.removeItem("admin_token");
            sessionStorage.removeItem("admin_user");
            window.dispatchEvent(new Event("admin-auth-expired"));
        }
        throw new Error(data.message || `Request failed: ${response.status}`);
    }
    return data;
}

export function getEmployeeLeaveRequests() {
    return request("employee/leave-requests", { employee: true });
}

export function getNotifications(employee = false) {
    return request(employee ? "employee/notifications" : "admin/notifications", { employee });
}

export function markNotificationRead(id, employee = false) {
    return request(employee ? "employee/notifications/read" : "admin/notifications/read", {
        employee,
        method: "PATCH",
        body: JSON.stringify(id === undefined ? {} : { id })
    });
}

export function submitEmployeeLeaveRequest(requestData) {
    return request("employee/leave-requests", {
        employee: true,
        method: "POST",
        body: JSON.stringify(requestData)
    });
}

export function getEmployeeAnnouncements() {
    return request("employee/announcements", { employee: true });
}

export function getEmployeeProfileChangeRequests() {
    return request("employee/profile-change-requests", { employee: true });
}

export function submitEmployeeProfileChangeRequest(changes, reason) {
    return request("employee/profile-change-requests", {
        employee: true,
        method: "POST",
        body: JSON.stringify({ changes, reason })
    });
}

export function updateEmployeePreferences(preferences) {
    return request("employee/preferences", {
        employee: true,
        method: "PATCH",
        body: JSON.stringify(preferences)
    });
}

export function getAdminProfileChangeRequests(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`admin/profile-change-requests${query}`);
}

export function reviewAdminProfileChangeRequest(id, status, notes) {
    return request(`admin/profile-change-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes })
    });
}

export function getAdminSettings() {
    return request("admin/me");
}

export function changeAdminPassword(currentPassword, newPassword) {
    return request("auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
    }).then(data => {
        if (data.token) {
            sessionStorage.setItem("admin_token", data.token);
        }
        return data;
    });
}

export function getAdminAuditLogs(limit = 50) {
    return request(`admin/audit-logs?limit=${encodeURIComponent(limit)}`);
}

export function getAdminLeaveRequests(status = "") {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`admin/leave-requests${query}`);
}

export function reviewLeaveRequest(id, status, notes) {
    return request(`admin/leave-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes })
    });
}

export function getAdminAnnouncements() {
    return request("admin/announcements");
}

export function publishAnnouncement(title, body) {
    return request("admin/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body })
    });
}

export function archiveAnnouncement(id) {
    return request(`admin/announcements/${id}/archive`, {
        method: "PATCH"
    });
}

export function getAdminAttendance(date, page = 1, limit = 25) {
    const params = new URLSearchParams({
        date,
        page: String(page),
        limit: String(limit)
    });
    return request(`admin/attendance?${params}`);
}

export function correctAttendance(id, checkIn, checkOut) {
    return request(`admin/attendance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ checkIn, checkOut })
    });
}

export function saveAttendance(attendance) {
    return request("admin/attendance", {
        method: "PUT",
        body: JSON.stringify(attendance)
    });
}
