
const API_URL = "/api";

async function attendanceRequest(endpoint, options = {}) {

    const token = sessionStorage.getItem("employee_token");

    if (!token) {
        throw new Error("Employee session expired. Please login again.");
    }

    const response = await fetch(
        `${API_URL}/employee/attendance${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(
            data.message || "Attendance request failed"
        );

        error.status = response.status;
        throw error;
    }

    return data;
}


// Get today's attendance
export async function getTodayAttendance() {
    return attendanceRequest("/today");
}


// Employee check-in
export async function employeeCheckIn() {
    return attendanceRequest("/check-in", {
        method: "POST"
    });
}


// Employee check-out
export async function employeeCheckOut() {
    return attendanceRequest("/check-out", {
        method: "POST"
    });
}


// Get attendance history
export async function getAttendanceHistory(page = 1, limit = 10) {

    return attendanceRequest(
        `?page=${page}&limit=${limit}`
    );
}
