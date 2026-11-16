
const API_URL = "/api/employees";
const AUTH_URL = "/api/auth";
const API_BASE_URL = "/api";

// Get stored admin token
export function getToken() {
  return sessionStorage.getItem("admin_token");
}

// Logout admin
export function logoutAdmin() {
  sessionStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_user");
}

// Handle API responses
async function handleResponse(response) {
  const contentType = response.headers.get("content-type");
  let data = {};

  if (contentType?.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(
      `Expected JSON but received: ${text.substring(0, 100)}`
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      logoutAdmin();
      window.dispatchEvent(new Event("admin-auth-expired"));
    }

    throw new Error(
      data.message || `API Error: ${response.status}`
    );
  }

  return data;
}

// Admin login
export async function loginAdmin(username, password) {
  const response = await fetch(`${AUTH_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  const data = await handleResponse(response);

  if (!data.token || !data.admin) {
    throw new Error("Invalid login response");
  }

  sessionStorage.setItem("admin_token", data.token);
  sessionStorage.setItem("admin_user", JSON.stringify(data.admin));

  return data;
}

// Common authenticated admin headers
function getAuthHeaders() {
  const token = getToken();

  if (!token) {
    throw new Error("Please login to continue");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

// Get all employees
export async function getEmployees({ search = "", department = "All", page = 1, limit = 25 } = {}) {
  const params = new URLSearchParams({
    search,
    department,
    page: String(page),
    limit: String(limit)
  });
  const response = await fetch(`${API_URL}?${params}`, {
    method: "GET",
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

export async function getEmployeeDetails(id) {
  const response = await fetch(`${API_URL}/${id}`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function getEmployeeManagers() {
  const response = await fetch(`${API_URL}/managers`, {
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function deactivateEmployee(id) {
  const response = await fetch(`${API_URL}/${id}/deactivate`, {
    method: "PATCH",
    headers: getAuthHeaders()
  });
  return handleResponse(response);
}

export async function exportEmployees({ search = "", department = "All" } = {}) {
  const params = new URLSearchParams({ search, department });
  const response = await fetch(`${API_URL}/export.csv?${params}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      logoutAdmin();
      window.dispatchEvent(new Event("admin-auth-expired"));
    }
    let message = `Export failed: ${response.status}`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the HTTP status as the actionable fallback.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "employees.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

// Add employee
export async function addEmployee(employee) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(employee)
  });

  return handleResponse(response);
}

// Update employee
export async function updateEmployee(id, employee) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(employee)
  });

  return handleResponse(response);
}

// Delete employee
export async function deleteEmployee(id) {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

// Get dashboard statistics
export async function getDashboardStats() {
  const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
    method: "GET",
    headers: getAuthHeaders()
  });

  return handleResponse(response);
}

// Get all employee accounts
export async function getEmployeeAccounts() {
  const response = await fetch(
    `${API_BASE_URL}/admin/employee-accounts`,
    {
      headers: getAuthHeaders()
    }
  );

  return handleResponse(response);
}

// Generate employee password

export async function generateEmployeePassword(employeeId) {
    const response = await fetch(
        `/api/admin/employee-accounts/${employeeId}/generate-password`,
        {
            method: "POST",
            headers: getAuthHeaders()
        }
    );

    return handleResponse(response);
}

