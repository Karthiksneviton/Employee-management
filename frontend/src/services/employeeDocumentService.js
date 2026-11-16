const DOCUMENT_API = "/api/admin/employees";
const EMPLOYEE_API = "/api/employee";

async function requestBlob(path, employee = false, preview = false) {
    const token = sessionStorage.getItem(employee ? "employee_token" : "admin_token");
    if (!token) throw new Error("Please sign in again to continue");
    const url = preview ? `${path}?preview=1` : path;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        let message = `Request failed: ${response.status}`;
        try {
            const data = await response.json();
            message = data.message || message;
        } catch {
            // The status remains the actionable error when the server response is not JSON.
        }
        throw new Error(message);
    }
    return response.blob();
}

async function upload(path, file, fields, employee = false) {
    const token = sessionStorage.getItem(employee ? "employee_token" : "admin_token");
    if (!token) throw new Error("Please sign in again to continue");
    const formData = new FormData();
    formData.append("file", file);
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formData.append(key, value);
    });
    const response = await fetch(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });
    let data = {};
    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response");
    }
    if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
    return data;
}

async function requestJson(path, method, employee = false) {
    const token = sessionStorage.getItem(employee ? "employee_token" : "admin_token");
    if (!token) throw new Error("Please sign in again to continue");
    const response = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}` }
    });
    let data = {};
    try {
        data = await response.json();
    } catch {
        throw new Error("The server returned an invalid response");
    }
    if (!response.ok) throw new Error(data.message || `Request failed: ${response.status}`);
    return data;
}

export function getAdminDocuments(employeeId) {
    return requestJson(`${DOCUMENT_API}/${employeeId}/documents`, "GET");
}

export function uploadAdminDocument(employeeId, file, documentType, expiresAt) {
    return upload(
        `${DOCUMENT_API}/${employeeId}/documents`,
        file,
        { documentType, expiresAt }
    );
}

export function getAdminDocumentFile(employeeId, documentId, preview = false) {
    return requestBlob(`${DOCUMENT_API}/${employeeId}/documents/${documentId}/file`, false, preview);
}

export function deleteAdminDocument(employeeId, documentId) {
    return requestJson(`${DOCUMENT_API}/${employeeId}/documents/${documentId}`, "DELETE");
}

export function uploadAdminProfilePhoto(employeeId, file) {
    return upload(`${DOCUMENT_API}/${employeeId}/profile-photo`, file, {});
}

export function getAdminProfilePhoto(employeeId) {
    return requestBlob(`${DOCUMENT_API}/${employeeId}/profile-photo`);
}

export function getEmployeeDocuments() {
    return requestJson(`${EMPLOYEE_API}/documents`, "GET", true);
}

export function uploadEmployeeDocument(file, documentType, expiresAt) {
    return upload(
        `${EMPLOYEE_API}/documents`,
        file,
        { documentType, expiresAt },
        true
    );
}

export function getEmployeeDocumentFile(documentId, preview = false) {
    return requestBlob(`${EMPLOYEE_API}/documents/${documentId}/file`, true, preview);
}

export function uploadEmployeeProfilePhoto(file) {
    return upload(`${EMPLOYEE_API}/profile-photo`, file, {}, true);
}

export function getEmployeeProfilePhoto() {
    return requestBlob(`${EMPLOYEE_API}/profile-photo`, true);
}
