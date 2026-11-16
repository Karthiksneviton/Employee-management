
const API_URL = "/api";

export async function employeeLogin(email, password) {
    const response = await fetch(
        `${API_URL}/employee/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Employee login failed"
        );
    }

    sessionStorage.setItem(
        "employee_token",
        data.token
    );

    sessionStorage.setItem(
        "employee_user",
        JSON.stringify(data.employee)
    );

    return data;
}


export async function getEmployeeProfile() {
    const token = sessionStorage.getItem("employee_token");

    if (!token) {
        const error = new Error("Employee session expired");
        error.status = 401;
        throw error;
    }

    const response = await fetch(
        `${API_URL}/employee/me`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(
            data.message || "Unable to load profile"
        );

        error.status = response.status;
        throw error;
    }

    return data.employee;
}

export async function changeEmployeePassword(currentPassword, newPassword) {
    const token = sessionStorage.getItem("employee_token");

    if (!token) {
        throw new Error("Employee session expired");
    }

    const response = await fetch(
        `${API_URL}/employee/auth/change-password`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Password change failed");
    }

    if (data.token) {
        sessionStorage.setItem("employee_token", data.token);
        const storedEmployee = sessionStorage.getItem("employee_user");
        if (storedEmployee) {
            try {
                const employee = JSON.parse(storedEmployee);
                employee.mustChangePassword = false;
                sessionStorage.setItem(
                    "employee_user",
                    JSON.stringify(employee)
                );
            } catch {
                sessionStorage.removeItem("employee_user");
            }
        }
    }

    return data;
}

export function logoutEmployee() {
    sessionStorage.removeItem("employee_token");
    sessionStorage.removeItem("employee_user");
}
