import { useEffect, useState } from "react";
import {
    deactivateEmployee,
    getEmployeeDetails,
    getEmployeeManagers,
    getEmployees
} from "../services/employeeService";
import {
    deleteAdminDocument,
    getAdminDocumentFile,
    getAdminDocuments,
    getAdminProfilePhoto,
    uploadAdminDocument
} from "../services/employeeDocumentService";
import EmployeeForm from "./EmployeeForm.jsx";
import { EMPLOYEE_STATUSES, getStatusLabel } from "../utils/statusOptions.js";
import "./HrPages.css";

const DOCUMENT_TYPES = [
    ["offer_letter", "Offer Letter"],
    ["joining_letter", "Joining Letter"],
    ["employment_contract", "Employment Contract"],
    ["id_proof", "ID Proof"],
    ["address_proof", "Address Proof"],
    ["certificate", "Certificate"],
    ["experience_letter", "Experience Letter"],
    ["payslip", "Payslip"],
    ["other", "Other"]
];

function display(value) {
    return value || "Not provided";
}

function formatDate(value) {
    if (!value) return "Not provided";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
    return Number.isNaN(date.getTime())
        ? "Not provided"
        : date.toLocaleDateString(undefined, { timeZone: "UTC" });
}

function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function AdminEmployees({ onChanged = async () => {} }) {
    const [employees, setEmployees] = useState([]);
    const [managers, setManagers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [appliedSearch, setAppliedSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [screen, setScreen] = useState("list");
    const [detail, setDetail] = useState(null);
    const [editing, setEditing] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [documentType, setDocumentType] = useState("offer_letter");
    const [expiresAt, setExpiresAt] = useState("");
    const [documentFile, setDocumentFile] = useState(null);
    const [documentError, setDocumentError] = useState("");
    const [documentBusy, setDocumentBusy] = useState(false);
    const [photoUrl, setPhotoUrl] = useState("");
    const [preview, setPreview] = useState(null);

    useEffect(() => () => {
        if (photoUrl) URL.revokeObjectURL(photoUrl);
    }, [photoUrl]);

    useEffect(() => () => {
        if (preview?.url) URL.revokeObjectURL(preview.url);
    }, [preview]);

    useEffect(() => {
        Promise.all([
            getEmployeeManagers(),
            getEmployees({ search: "", page: 1, limit: 25 })
        ])
            .then(([managerData, employeeData]) => {
                setManagers(managerData.managers);
                setEmployees(employeeData.employees);
                setPage(employeeData.pagination.page);
                setTotalPages(Math.max(1, employeeData.pagination.totalPages));
            })
            .catch(loadError => {
                setError(loadError.message || "Unable to load employee management data");
            })
            .finally(() => setLoading(false));
    }, []);

    async function loadPage(nextPage = page, nextSearch = search) {
        setLoading(true);
        setError("");
        try {
            const data = await getEmployees({
                search: nextSearch,
                page: nextPage,
                limit: 25
            });
            setEmployees(data.employees);
            setPage(data.pagination.page);
            setTotalPages(Math.max(1, data.pagination.totalPages));
        } catch (loadError) {
            setError(loadError.message || "Unable to load employees");
            throw loadError;
        } finally {
            setLoading(false);
        }
    }

    async function showDetails(id) {
        setError("");
        setScreen("detail");
        setLoading(true);
        setDetail(null);
        setDocuments([]);
        setPhotoUrl("");
        try {
            const [employeeData, documentData] = await Promise.all([
                getEmployeeDetails(id),
                getAdminDocuments(id)
            ]);
            setDetail(employeeData);
            setDocuments(documentData.documents);
            if (employeeData.employee.profile_photo_path) {
                const photo = await getAdminProfilePhoto(id);
                setPhotoUrl(URL.createObjectURL(photo));
            }
        } catch (loadError) {
            setError(loadError.message || "Unable to load employee profile");
            setScreen("list");
        } finally {
            setLoading(false);
        }
    }

    function startCreate() {
        setError("");
        setEditing(null);
        setScreen("form");
    }

    async function startEdit() {
        setError("");
        try {
            const result = await getEmployeeDetails(detail.employee.id);
            setEditing(result.employee);
            setScreen("form");
        } catch (loadError) {
            setError(loadError.message || "Unable to load employee for editing");
        }
    }

    async function editEmployee(id) {
        setError("");
        try {
            const result = await getEmployeeDetails(id);
            setEditing(result.employee);
            setScreen("form");
        } catch (loadError) {
            setError(loadError.message || "Unable to load employee for editing");
        }
    }

    async function handleSaved(id) {
        setSaving(true);
        try {
            try {
                await loadPage(1, appliedSearch);
            } catch {
                setError("Employee saved, but the employee list could not be refreshed.");
            }
            await onChanged();
            await showDetails(id);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeactivate() {
        if (!detail?.employee) return;
        if (!window.confirm(`Deactivate ${detail.employee.name}? This will revoke their employee login.`)) {
            return;
        }
        try {
            setSaving(true);
            setError("");
            await deactivateEmployee(detail.employee.id);
            await onChanged();
            await showDetails(detail.employee.id);
            await loadPage(page, appliedSearch);
        } catch (actionError) {
            setError(actionError.message || "Unable to deactivate employee");
        } finally {
            setSaving(false);
        }
    }

    async function handleDocumentUpload(event) {
        event.preventDefault();
        if (!documentFile || !detail?.employee) {
            setDocumentError("Select a document to upload.");
            return;
        }
        if (documentFile.size > 10 * 1024 * 1024) {
            setDocumentError("Documents must be 10 MB or smaller.");
            return;
        }
        try {
            setDocumentBusy(true);
            setDocumentError("");
            await uploadAdminDocument(
                detail.employee.id,
                documentFile,
                documentType,
                expiresAt
            );
            const result = await getAdminDocuments(detail.employee.id);
            setDocuments(result.documents);
            setDocumentFile(null);
            setExpiresAt("");
            event.currentTarget.reset();
        } catch (uploadError) {
            setDocumentError(uploadError.message || "Unable to upload document");
        } finally {
            setDocumentBusy(false);
        }
    }

    async function previewDocument(document) {
        try {
            setDocumentError("");
            const blob = await getAdminDocumentFile(
                detail.employee.id,
                document.id,
                true
            );
            setPreview({
                url: URL.createObjectURL(blob),
                name: document.original_name,
                type: document.mime_type
            });
        } catch (previewError) {
            setDocumentError(previewError.message || "Unable to preview document");
        }
    }

    async function downloadDocument(document) {
        try {
            const blob = await getAdminDocumentFile(detail.employee.id, document.id);
            saveBlob(blob, document.original_name);
        } catch (downloadError) {
            setDocumentError(downloadError.message || "Unable to download document");
        }
    }

    async function removeDocument(document) {
        if (!window.confirm(`Delete ${document.original_name}?`)) return;
        try {
            setDocumentBusy(true);
            setDocumentError("");
            await deleteAdminDocument(detail.employee.id, document.id);
            setDocuments(current => current.filter(item => item.id !== document.id));
        } catch (deleteError) {
            setDocumentError(deleteError.message || "Unable to delete document");
        } finally {
            setDocumentBusy(false);
        }
    }

    if (screen === "form") {
        return (
            <section className="hr-page">
                <header className="hr-page-header">
                    <div>
                        <h2>{editing ? "Edit Employee Profile" : "Create Employee Profile"}</h2>
                        <p>Update personal, employment, and emergency contact information.</p>
                    </div>
                </header>
                <EmployeeForm
                    key={editing?.id || "new"}
                    initialEmployee={editing}
                    managers={managers}
                    onCancel={() => setScreen(editing ? "detail" : "list")}
                    onSaved={handleSaved}
                />
            </section>
        );
    }

    if (screen === "detail") {
        const employee = detail?.employee;
        return (
            <section className="hr-page">
                <header className="hr-page-header employee-detail-header">
                    <div>
                        <button className="secondary" onClick={() => setScreen("list")}>
                            Back to employees
                        </button>
                        <h2>{employee?.name || "Employee profile"}</h2>
                        <p>{employee ? `${employee.role} · ${employee.department}` : ""}</p>
                        {employee && (
                            <span className={`hr-status ${employee.status}`}>
                                {getStatusLabel(EMPLOYEE_STATUSES, employee.status)}
                            </span>
                        )}
                    </div>
                    {employee && (
                        <div className="employee-detail-actions">
                            <button onClick={startEdit} disabled={saving}>Edit Profile</button>
                            <button
                                className="danger"
                                onClick={handleDeactivate}
                                disabled={saving || employee.status === "inactive"}
                            >
                                Deactivate
                            </button>
                        </div>
                    )}
                </header>
                {error && <p className="hr-alert error" role="alert">{error}</p>}
                {loading || !detail ? <p>Loading employee profile...</p> : (
                    <>
                        <section className="hr-card employee-detail-card">
                            <div className="employee-detail-person">
                                {photoUrl
                                    ? <img src={photoUrl} alt={`${employee.name} profile`} />
                                    : <span>{employee.first_name?.charAt(0) || employee.name?.charAt(0)}</span>}
                                <div>
                                    <h3>{employee.name}</h3>
                                    <p>{employee.role} · {employee.department}</p>
                                    <p>{employee.employee_code || `#${employee.id}`}</p>
                                </div>
                            </div>
                            <div className="employee-detail-grid">
                                <section>
                                    <h3>Personal Information</h3>
                                    <dl>
                                        <dt>Full name</dt><dd>{employee.name}</dd>
                                        <dt>Email</dt><dd>{employee.email}</dd>
                                        <dt>Phone</dt><dd>{display(employee.phone)}</dd>
                                        <dt>Date of birth</dt><dd>{formatDate(employee.date_of_birth)}</dd>
                                        <dt>Gender</dt><dd>{display(employee.gender)}</dd>
                                        <dt>Address</dt>
                                        <dd>{[employee.address, employee.city, employee.state, employee.country].filter(Boolean).join(", ") || "Not provided"}</dd>
                                    </dl>
                                </section>
                                <section>
                                    <h3>Employment Information</h3>
                                    <dl>
                                        <dt>Employee ID</dt><dd>{employee.employee_code || `#${employee.id}`}</dd>
                                        <dt>Department</dt><dd>{employee.department}</dd>
                                        <dt>Designation</dt><dd>{employee.role}</dd>
                                        <dt>Manager</dt><dd>{display(employee.manager_name)}</dd>
                                        <dt>Joining date</dt><dd>{formatDate(employee.joining_date)}</dd>
                                        <dt>Employment type</dt><dd>{display(employee.employment_type?.replace("_", " "))}</dd>
                                        <dt>Work location</dt><dd>{display(employee.work_location)}</dd>
                                        <dt>Status</dt><dd>{getStatusLabel(EMPLOYEE_STATUSES, employee.status)}</dd>
                                    </dl>
                                </section>
                                <section>
                                    <h3>Emergency Contact</h3>
                                    <dl>
                                        <dt>Name</dt><dd>{display(employee.emergency_contact_name)}</dd>
                                        <dt>Relationship</dt><dd>{display(employee.emergency_contact_relationship)}</dd>
                                        <dt>Phone</dt><dd>{display(employee.emergency_contact_phone)}</dd>
                                        <dt>Email</dt><dd>{display(employee.emergency_contact_email)}</dd>
                                    </dl>
                                </section>
                                <section>
                                    <h3>Attendance</h3>
                                    <dl>
                                        <dt>Present</dt><dd>{detail.attendance.present}</dd>
                                        <dt>Absent</dt><dd>{detail.attendance.absent}</dd>
                                        <dt>Late</dt><dd>{detail.attendance.late}</dd>
                                        <dt>Leave</dt><dd>{detail.attendance.leave}</dd>
                                    </dl>
                                </section>
                                <section>
                                    <h3>Leave</h3>
                                    <dl>
                                        <dt>Total leave</dt><dd>{detail.leave.remaining === null ? "Not configured" : `${detail.leave.entitlement} days`}</dd>
                                        <dt>Used leave</dt><dd>{detail.leave.used} days</dd>
                                        <dt>Remaining leave</dt><dd>{detail.leave.remaining === null ? "Not configured" : `${detail.leave.remaining} days`}</dd>
                                    </dl>
                                </section>
                            </div>
                        </section>

                        <section className="hr-card">
                            <h3>Documents</h3>
                            <form className="employee-document-upload" onSubmit={handleDocumentUpload}>
                                <label>
                                    Document type
                                    <select value={documentType} onChange={event => setDocumentType(event.target.value)}>
                                        {DOCUMENT_TYPES.map(([value, title]) => <option key={value} value={value}>{title}</option>)}
                                    </select>
                                </label>
                                <label>
                                    Expiry date
                                    <input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} />
                                </label>
                                <label>
                                    File (PDF, PNG, or JPEG; max 10 MB)
                                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={event => setDocumentFile(event.target.files?.[0] || null)} />
                                </label>
                                <button type="submit" disabled={documentBusy}>
                                    {documentBusy ? "Uploading..." : "Upload document"}
                                </button>
                            </form>
                            {documentError && <p className="hr-alert error" role="alert">{documentError}</p>}
                            {documents.length === 0 ? <p>No documents have been uploaded.</p> : (
                                <div className="hr-table-wrap">
                                    <table>
                                        <thead>
                                            <tr><th>Document</th><th>Type</th><th>Expiry</th><th>Actions</th></tr>
                                        </thead>
                                        <tbody>
                                            {documents.map(document => (
                                                <tr key={document.id}>
                                                    <td>{document.original_name}</td>
                                                    <td>{DOCUMENT_TYPES.find(([value]) => value === document.document_type)?.[1] || "Other"}</td>
                                                    <td>{formatDate(document.expires_at)}</td>
                                                    <td className="employee-document-actions">
                                                        <button onClick={() => previewDocument(document)}>Preview</button>
                                                        <button onClick={() => downloadDocument(document)}>Download</button>
                                                        <button className="danger" onClick={() => removeDocument(document)} disabled={documentBusy}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}
                {preview && (
                    <div className="employee-preview-backdrop" role="presentation" onClick={() => setPreview(null)}>
                        <section className="employee-preview-dialog" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onClick={event => event.stopPropagation()}>
                            <header><strong>{preview.name}</strong><button onClick={() => setPreview(null)}>Close</button></header>
                            {preview.type.startsWith("image/")
                                ? <img src={preview.url} alt={preview.name} />
                                : <iframe title={preview.name} src={preview.url} />}
                        </section>
                    </div>
                )}
            </section>
        );
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Employee Management</h2>
                    <p>Create and manage employee records and their documents.</p>
                </div>
                <button onClick={startCreate}>Add Employee</button>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            <section className="hr-card">
                <form className="employee-search-form" onSubmit={event => {
                    event.preventDefault();
                    setAppliedSearch(search);
                    setPage(1);
                    loadPage(1, search);
                }}>
                    <input
                        type="search"
                        aria-label="Search employees"
                        placeholder="Search name, email, role, department, or employee ID"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                    <button type="submit">Search</button>
                </form>
                {loading ? <p>Loading employees...</p> : employees.length === 0 ? (
                    <p>No employees found.</p>
                ) : (
                    <div className="hr-table-wrap">
                        <table>
                            <thead><tr><th>Employee ID</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {employees.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.employee_code || `#${item.id}`}</td>
                                        <td>{item.name}</td>
                                        <td>{item.email}</td>
                                        <td>{item.department}</td>
                                        <td>{item.role}</td>
                                        <td><span className={`hr-status ${item.status}`}>{getStatusLabel(EMPLOYEE_STATUSES, item.status)}</span></td>
                                        <td className="employee-document-actions">
                                            <button onClick={() => showDetails(item.id)}>View</button>
                                            <button onClick={() => editEmployee(item.id)}>Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="hr-pagination">
                    <span>Page {page} of {totalPages}</span>
                    <div>
                        <button className="secondary" disabled={page <= 1} onClick={() => loadPage(page - 1, appliedSearch)}>Previous</button>
                        <button disabled={page >= totalPages} onClick={() => loadPage(page + 1, appliedSearch)}>Next</button>
                    </div>
                </div>
            </section>
        </section>
    );
}

export default AdminEmployees;
