import EmployeeAttendance from "./components/EmployeeAttendance";
import { useEffect, useRef, useState } from "react";
import {
    getEmployeeProfile,
    changeEmployeePassword,
    logoutEmployee
} from "./services/employeeAuthService";
import {
    getEmployeeDocumentFile,
    getEmployeeDocuments,
    getEmployeeProfilePhoto,
    uploadEmployeeDocument,
    uploadEmployeeProfilePhoto
} from "./services/employeeDocumentService.js";
import { updateEmployeePreferences } from "./services/hrService.js";
import EmployeeLeave from "./components/EmployeeLeave.jsx";
import EmployeeAnnouncements from "./components/EmployeeAnnouncements.jsx";
import EmployeeProfileCorrection from "./components/EmployeeProfileCorrection.jsx";
import NotificationCenter from "./components/NotificationCenter.jsx";
import logo from "./image/logo.png";
import { EMPLOYEE_STATUSES, getStatusLabel } from "./utils/statusOptions.js";

import "./EmployeeDashboard.css";

const DEFAULT_PREFERENCES = {
    email_notifications: true,
    leave_updates: true,
    announcements: true,
    attendance_alerts: true,
    language: "en",
    time_zone: "Asia/Kolkata",
    theme: "system"
};

function formatActivityDate(value, timeZone) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone
    }).format(date);
}

function EmployeeDashboard({ employee, onLogout }) {

    const [profile, setProfile] = useState(employee);
    const [mustChangePassword, setMustChangePassword] = useState(
        Boolean(employee.mustChangePassword)
    );
    const [loading, setLoading] = useState(!employee.mustChangePassword);
    const [error, setError] = useState("");
    const [activePage, setActivePage] = useState(
        employee.mustChangePassword ? "Settings" : "Dashboard"
    );
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordSubmitting, setPasswordSubmitting] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);
    const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
    const [showProfileCorrection, setShowProfileCorrection] = useState(false);
    const [photoError, setPhotoError] = useState("");
    const [photoSaving, setPhotoSaving] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [documentPreview, setDocumentPreview] = useState(null);
    const [documentFile, setDocumentFile] = useState(null);
    const documentFormRef = useRef(null);
    const [documentType, setDocumentType] = useState("certificate");
    const [documentExpiry, setDocumentExpiry] = useState("");
    const [documentError, setDocumentError] = useState("");
    const [documentSaving, setDocumentSaving] = useState(false);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [preferencesSaving, setPreferencesSaving] = useState(false);
    const [preferencesError, setPreferencesError] = useState("");
    const [preferencesMessage, setPreferencesMessage] = useState("");

    useEffect(() => {
        if (mustChangePassword) {
            return undefined;
        }

        let mounted = true;

        async function loadProfile() {
            try {
                setLoading(true);
                setError("");

                const data = await getEmployeeProfile();

                if (mounted) {
                    setProfile(data);
                    setPreferences(data.preferences || DEFAULT_PREFERENCES);
                    if (data.profile_photo_path) {
                        const photo = await getEmployeeProfilePhoto();
                        if (mounted) setProfilePhotoUrl(URL.createObjectURL(photo));
                    }
                }

            } catch (err) {

                if (!mounted) return;

                setError(err.message || "Unable to load profile");

                // Authentication failure
                if (
                    err.status === 401 ||
                    err.status === 403
                ) {
                    logoutEmployee();
                    onLogout();
                }

            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            mounted = false;
        };

    }, [onLogout, employee, mustChangePassword]);

    useEffect(() => () => {
        if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
    }, [profilePhotoUrl]);

    useEffect(() => () => {
        if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
    }, [documentPreview]);

    useEffect(() => {
        if (activePage !== "Profile" || !profile?.id) return undefined;
        let mounted = true;
        getEmployeeDocuments()
            .then(data => {
                if (mounted) setDocuments(data.documents);
            })
            .catch(error => {
                if (mounted) setDocumentError(error.message || "Unable to load documents");
            });
        return () => {
            mounted = false;
        };
    }, [activePage, profile?.id]);

    function handleLogout() {
        logoutEmployee();
        onLogout();
    }

    async function handlePasswordChange(event) {
        event.preventDefault();
        setPasswordError("");
        setPasswordMessage("");

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match");
            return;
        }
        if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
            setPasswordError("New password must contain 12 to 72 bytes");
            return;
        }

        try {
            setPasswordSubmitting(true);
            const result = await changeEmployeePassword(
                currentPassword,
                newPassword
            );
            setPasswordMessage(result.message);
            setMustChangePassword(false);
            setActivePage("Dashboard");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setPasswordError(err.message || "Unable to change password");
        } finally {
            setPasswordSubmitting(false);
        }
    }

    async function handleProfilePhotoChange(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setPhotoError("Profile photos must be 5 MB or smaller.");
            return;
        }
        try {
            setPhotoSaving(true);
            setPhotoError("");
            await uploadEmployeeProfilePhoto(file);
            const photo = await getEmployeeProfilePhoto();
            setProfilePhotoUrl(URL.createObjectURL(photo));
            setProfile(current => ({ ...current, profile_photo_path: "uploaded" }));
        } catch (error) {
            setPhotoError(error.message || "Unable to update profile photo");
        } finally {
            setPhotoSaving(false);
            event.target.value = "";
        }
    }

    async function handleDocumentUpload(event) {
        event.preventDefault();
        if (!documentFile) {
            setDocumentError("Select a document to upload.");
            return;
        }
        if (documentFile.size > 10 * 1024 * 1024) {
            setDocumentError("Documents must be 10 MB or smaller.");
            return;
        }
        try {
            setDocumentSaving(true);
            setDocumentError("");
            await uploadEmployeeDocument(documentFile, documentType, documentExpiry);
            const result = await getEmployeeDocuments();
            setDocuments(result.documents);
            setDocumentFile(null);
            setDocumentExpiry("");
            documentFormRef.current?.reset();
        } catch (error) {
            setDocumentError(error.message || "Unable to upload document");
        } finally {
            setDocumentSaving(false);
        }
    }

    async function handleDocumentOpen(item, preview) {
        try {
            setDocumentError("");
            const file = await getEmployeeDocumentFile(item.id, preview);
            const url = URL.createObjectURL(file);
            if (preview) {
                setDocumentPreview({
                    url,
                    name: item.original_name,
                    type: item.mime_type
                });
            } else {
                const link = window.document.createElement("a");
                link.href = url;
                link.download = item.original_name;
                link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 0);
            }
        } catch (error) {
            setDocumentError(error.message || "Unable to open document");
        }
    }

    async function handlePreferencesSave(event) {
        event.preventDefault();
        try {
            setPreferencesSaving(true);
            setPreferencesError("");
            setPreferencesMessage("");
            const result = await updateEmployeePreferences({
                emailNotifications: preferences.email_notifications,
                leaveUpdates: preferences.leave_updates,
                announcements: preferences.announcements,
                attendanceAlerts: preferences.attendance_alerts,
                language: preferences.language,
                timeZone: preferences.time_zone,
                theme: preferences.theme
            });
            setPreferences(result.preferences);
            setPreferencesMessage("Preferences saved.");
        } catch (error) {
            setPreferencesError(error.message || "Unable to save preferences");
        } finally {
            setPreferencesSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="employee-loading">
                Loading your dashboard...
            </div>
        );
    }

    if (error) {
        return (
            <div className="employee-error">
                <h2>Unable to load dashboard</h2>
                <p>{error}</p>
                <button onClick={handleLogout}>
                    Logout
                </button>
            </div>
        );
    }

    if (!profile) return null;

    const firstName = profile.name?.split(" ")[0] || "Employee";

    function renderDashboard() {
        return (
            <>
                <section className="employee-welcome">
                    <div>
                        <h2>Hello, {firstName}! 👋</h2>
                        <p>
                            Welcome to your employee self-service portal.
                            Manage your work information from one place.
                        </p>
                    </div>
                    <div className="welcome-icon">👨‍💼</div>
                </section>

                <section className="employee-summary">

                    <div className="employee-card">
                        <div className="card-icon blue">👤</div>
                        <h3>Employee ID</h3>
                        <h2>{profile.employee_code || `#${profile.id}`}</h2>
                    </div>

                    <div className="employee-card">
                        <div className="card-icon purple">🏢</div>
                        <h3>Department</h3>
                        <h2>{profile.department || "N/A"}</h2>
                    </div>

                    <div className="employee-card">
                        <div className="card-icon green">💼</div>
                        <h3>Job Role</h3>
                        <h2>{profile.role || "N/A"}</h2>
                    </div>

                </section>

                <section className="employee-profile">
                    <div className="section-heading">
                        <div>
                            <h2>Employee Information</h2>
                            <p>Your employment information at a glance.</p>
                        </div>

                        <button
                            className="view-btn"
                            onClick={() => setActivePage("Profile")}
                        >
                            View Profile
                        </button>
                    </div>

                    <div className="employee-details">
                        <div>
                            <label>Full Name</label>
                            <p>{profile.name || "N/A"}</p>
                        </div>

                        <div>
                            <label>Email Address</label>
                            <p>{profile.email || "N/A"}</p>
                        </div>

                        <div>
                            <label>Employee ID</label>
                            <p>{profile.id ?? "N/A"}</p>
                        </div>

                        <div>
                            <label>Department</label>
                            <p>{profile.department || "N/A"}</p>
                        </div>

                        <div>
                            <label>Job Role</label>
                            <p>{profile.role || "N/A"}</p>
                        </div>

                        <div>
                            <label>Employment Status</label>
                            <p className={`employee-status ${profile.status || "active"}`}>
                                {getStatusLabel(EMPLOYEE_STATUSES, profile.status || "active")}
                            </p>
                        </div>
                    </div>
                </section>
            </>
        );
    }

    function renderProfile() {
        const address = [
            profile.address,
            profile.city,
            profile.state,
            profile.country
        ].filter(Boolean).join(", ");

        return (
            <>
                <section className="employee-profile">
                    <div className="profile-banner">
                        {profilePhotoUrl
                            ? <img className="employee-avatar large employee-profile-photo" src={profilePhotoUrl} alt={`${profile.name} profile`} />
                            : <div className="employee-avatar large">{profile.name?.charAt(0).toUpperCase()}</div>}
                        <div>
                            <h2>{profile.name}</h2>
                            <p>{profile.role} · {profile.department}</p>
                            <p>{profile.employee_code || `#${profile.id}`}</p>
                        </div>
                        <button className="view-btn" onClick={() => setShowProfileCorrection(value => !value)}>
                            {showProfileCorrection ? "Close Edit Profile" : "Edit Profile"}
                        </button>
                    </div>

                    <section className="employee-readonly-section">
                        <h3>Personal Information</h3>
                        <div className="employee-details">
                            <div><label>Full Name</label><p>{profile.name || "N/A"}</p></div>
                            <div><label>Email</label><p>{profile.email || "N/A"}</p></div>
                            <div><label>Phone</label><p>{profile.phone || "N/A"}</p></div>
                            <div><label>Date of Birth</label><p>{profile.date_of_birth?.slice(0, 10) || "N/A"}</p></div>
                            <div><label>Address</label><p>{address || "N/A"}</p></div>
                            <div><label>Gender</label><p>{profile.gender?.replaceAll("_", " ") || "N/A"}</p></div>
                        </div>
                    </section>

                    <section className="employee-readonly-section">
                        <h3>Employment Information (read only)</h3>
                        <div className="employee-details">
                            <div><label>Employee ID</label><p>{profile.employee_code || `#${profile.id}`}</p></div>
                            <div><label>Department</label><p>{profile.department || "N/A"}</p></div>
                            <div><label>Designation</label><p>{profile.role || "N/A"}</p></div>
                            <div><label>Manager</label><p>{profile.manager_name || "N/A"}</p></div>
                            <div><label>Joining Date</label><p>{profile.joining_date?.slice(0, 10) || "N/A"}</p></div>
                            <div><label>Employment Type</label><p>{profile.employment_type?.replaceAll("_", " ") || "N/A"}</p></div>
                            <div><label>Work Location</label><p>{profile.work_location || "N/A"}</p></div>
                            <div><label>Employment Status</label><p className={`employee-status ${profile.status || "active"}`}>{getStatusLabel(EMPLOYEE_STATUSES, profile.status || "active")}</p></div>
                        </div>
                    </section>

                    <section className="employee-readonly-section">
                        <h3>Attendance</h3>
                        <div className="employee-details">
                            <div><label>Present</label><p>{profile.attendance?.present ?? 0}</p></div>
                            <div><label>Absent</label><p>{profile.attendance?.absent ?? 0}</p></div>
                            <div><label>Late</label><p>{profile.attendance?.late ?? 0}</p></div>
                            <div><label>Leave</label><p>{profile.attendance?.leave ?? 0}</p></div>
                        </div>
                    </section>

                    <section className="employee-readonly-section">
                        <h3>Leave balance (current calendar year)</h3>
                        <div className="employee-details">
                            <div><label>Total Leave</label><p>{profile.leave?.remaining === null ? "Not configured" : `${profile.leave?.entitlement ?? 0} days`}</p></div>
                            <div><label>Used Leave</label><p>{profile.leave?.used ?? 0} days</p></div>
                            <div><label>Remaining Leave</label><p>{profile.leave?.remaining === null ? "Not configured" : `${profile.leave?.remaining ?? 0} days`}</p></div>
                        </div>
                    </section>

                    <section className="employee-readonly-section">
                        <h3>Profile picture</h3>
                        <label className="employee-photo-upload">
                            {photoSaving ? "Uploading..." : "Change profile picture (JPEG or PNG, max 5 MB)"}
                            <input type="file" accept="image/png,image/jpeg" onChange={handleProfilePhotoChange} disabled={photoSaving} />
                        </label>
                        {photoError && <p className="employee-password-error" role="alert">{photoError}</p>}
                    </section>

                    <section className="employee-readonly-section">
                        <h3>Documents</h3>
                        <form ref={documentFormRef} className="employee-document-form" onSubmit={handleDocumentUpload}>
                            <label>
                                Document type
                                <select value={documentType} onChange={event => setDocumentType(event.target.value)}>
                                    <option value="offer_letter">Offer Letter</option>
                                    <option value="joining_letter">Joining Letter</option>
                                    <option value="employment_contract">Employment Contract</option>
                                    <option value="id_proof">ID Proof</option>
                                    <option value="address_proof">Address Proof</option>
                                    <option value="certificate">Certificate</option>
                                    <option value="experience_letter">Experience Letter</option>
                                    <option value="payslip">Payslip</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            <label>
                                Expiry date
                                <input type="date" value={documentExpiry} onChange={event => setDocumentExpiry(event.target.value)} />
                            </label>
                            <label>
                                Select file (PDF, PNG, or JPEG; max 10 MB)
                                <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={event => setDocumentFile(event.target.files?.[0] || null)} />
                            </label>
                            <button type="submit" disabled={documentSaving}>{documentSaving ? "Uploading..." : "Upload document"}</button>
                        </form>
                        {documentError && <p className="employee-password-error" role="alert">{documentError}</p>}
                        {documents.length === 0 ? <p>No documents are available.</p> : (
                            <div className="employee-documents-list">
                                {documents.map(item => (
                                    <div key={item.id}>
                                        <span>{item.original_name}</span>
                                        <button onClick={() => handleDocumentOpen(item, true)}>Preview</button>
                                        <button onClick={() => handleDocumentOpen(item, false)}>Download</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {documentPreview && (
                            <div className="employee-document-preview">
                                <div>
                                    <strong>{documentPreview.name}</strong>
                                    <button onClick={() => setDocumentPreview(null)}>Close preview</button>
                                </div>
                                {documentPreview.type.startsWith("image/")
                                    ? <img src={documentPreview.url} alt={documentPreview.name} />
                                    : <iframe title={documentPreview.name} src={documentPreview.url} />}
                            </div>
                        )}
                    </section>
                </section>

                {showProfileCorrection && (
                    <EmployeeProfileCorrection profile={profile} />
                )}
            </>
        );
    }

    function renderSettings() {
        return (
            <div className="employee-settings-sections">
                <section className="employee-profile employee-settings">
                    <h2>Name and Email</h2>
                    <p>Your official name and email are managed through profile correction requests.</p>
                    <div className="employee-details">
                        <div><label>Name</label><p>{profile.name}</p></div>
                        <div><label>Email</label><p>{profile.email}</p></div>
                    </div>
                    <button className="view-btn" onClick={() => {
                        setShowProfileCorrection(true);
                        setActivePage("Profile");
                    }}>Edit Profile</button>
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Profile Picture</h2>
                    <p>Upload a JPEG or PNG image up to 5 MB.</p>
                    <label className="employee-photo-upload">
                        Change profile picture
                        <input type="file" accept="image/png,image/jpeg" onChange={handleProfilePhotoChange} disabled={photoSaving} />
                    </label>
                    {photoError && <p className="employee-password-error" role="alert">{photoError}</p>}
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Change Password</h2>
                    <p>
                        {mustChangePassword
                            ? "Set a new password before using the employee portal."
                            : "Change your employee account password."}
                    </p>
                    <p className="password-requirement-hint">
                        Use a unique password with at least 12 characters. Passwords are case-sensitive.
                    </p>
                    <form className="employee-security-form" onSubmit={handlePasswordChange}>
                        <label htmlFor="employee-current-password">Current password</label>
                        <input id="employee-current-password" type={showPasswords ? "text" : "password"} autoComplete="current-password" value={currentPassword} maxLength={72} onChange={event => setCurrentPassword(event.target.value)} required />
                        <label htmlFor="employee-new-password">New password</label>
                        <input id="employee-new-password" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
                        <label htmlFor="employee-confirm-password">Confirm new password</label>
                        <input id="employee-confirm-password" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={72} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required />
                        <label className="employee-show-password">
                            <input type="checkbox" checked={showPasswords} onChange={event => setShowPasswords(event.target.checked)} />
                            Show passwords
                        </label>
                        <button type="submit" disabled={passwordSubmitting}>{passwordSubmitting ? "Changing..." : "Change password"}</button>
                    </form>
                    {passwordError && <p className="employee-password-error" role="alert">{passwordError}</p>}
                    {passwordMessage && <p className="employee-password-success" role="status">{passwordMessage}</p>}
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Two-Factor Authentication</h2>
                    <p>Two-factor sign-in is not configured for this portal yet.</p>
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Active Sessions</h2>
                    <p>This browser is signed in. Changing your password or deactivating your account revokes employee sessions.</p>
                    <button type="button" className="view-btn" onClick={handleLogout}>Sign out from this device</button>
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Login Activity</h2>
                    {!profile.login_activity?.length ? <p>No login activity has been recorded.</p> : (
                        <div className="employee-documents-list">
                            {profile.login_activity.map((activity, index) => (
                                <div key={`${activity.created_at}-${index}`}>
                                    <span>{formatActivityDate(activity.created_at, preferences.time_zone)}</span>
                                    <span>{activity.user_agent || "Unknown device"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="employee-profile employee-settings">
                    <h2>Notifications and Preferences</h2>
                    <p>Email delivery is not configured; notification options are saved for in-app/policy preferences.</p>
                    <form className="employee-preferences-form" onSubmit={handlePreferencesSave}>
                        {[
                            ["email_notifications", "Email Notifications"],
                            ["leave_updates", "Leave Updates"],
                            ["announcements", "Announcements"],
                            ["attendance_alerts", "Attendance Alerts"]
                        ].map(([field, label]) => (
                            <label key={field}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(preferences[field])}
                                    onChange={event => setPreferences(current => ({
                                        ...current,
                                        [field]: event.target.checked
                                    }))}
                                />
                                {label}
                            </label>
                        ))}
                        <label>
                            Language
                            <select value={preferences.language} onChange={event => setPreferences(current => ({ ...current, language: event.target.value }))}>
                                <option value="en">English</option>
                                <option value="hi">Hindi</option>
                            </select>
                        </label>
                        <label>
                            Time Zone
                            <select value={preferences.time_zone} onChange={event => setPreferences(current => ({ ...current, time_zone: event.target.value }))}>
                                <option value="Asia/Kolkata">Asia/Kolkata</option>
                                <option value="UTC">UTC</option>
                                <option value="America/New_York">America/New_York</option>
                                <option value="Europe/London">Europe/London</option>
                            </select>
                        </label>
                        <label>
                            Theme
                            <select value={preferences.theme} onChange={event => setPreferences(current => ({ ...current, theme: event.target.value }))}>
                                <option value="system">System</option>
                                <option value="light">Light</option>
                                <option value="dark">Dark</option>
                            </select>
                        </label>
                        <button type="submit" disabled={preferencesSaving}>{preferencesSaving ? "Saving..." : "Save preferences"}</button>
                    </form>
                    {preferencesError && <p className="employee-password-error" role="alert">{preferencesError}</p>}
                    {preferencesMessage && <p className="employee-password-success" role="status">{preferencesMessage}</p>}
                </section>
            </div>
        );
    }

    function renderPage() {
        switch (activePage) {
            case "Dashboard":
                return renderDashboard();

            case "Profile":
                return renderProfile();

            case "Attendance":
                 return <EmployeeAttendance />;
                

            case "Leave":
                return <EmployeeLeave />;

            case "Announcements":
                return <EmployeeAnnouncements />;

            case "Settings":
                return renderSettings();

            default:
                return renderDashboard();
        }
    }

    const navItems = [
        { name: "Dashboard", icon: "🏠" },
        { name: "Profile", icon: "👤" },
        { name: "Attendance", icon: "📅" },
        { name: "Leave", icon: "📝" },
        { name: "Announcements", icon: "📢" },
        { name: "Settings", icon: "⚙️" }
    ];
    const visibleNavItems = mustChangePassword
        ? navItems.filter(item => item.name === "Settings")
        : navItems;

    return (
        <div className={`employee-dashboard employee-theme-${preferences.theme || "system"}`}>

            {/* SIDEBAR */}

            <aside className="employee-sidebar">

                <div className="employee-brand">
                    <img src={logo} alt="" />
                    <div>
                        <h2>EmployeeHub</h2>
                        <span>HR Management</span>
                    </div>
                </div>

                <p className="sidebar-label">MAIN MENU</p>

                <nav className="employee-nav">

                    {visibleNavItems.map(item => (
                        <button
                            key={item.name}
                            className={
                                activePage === item.name
                                    ? "active"
                                    : ""
                            }
                            onClick={() => setActivePage(item.name)}
                            disabled={mustChangePassword && item.name !== "Settings"}
                        >
                            <span>{item.icon}</span>
                            {item.name}
                        </button>
                    ))}

                </nav>

                <button
                    className="employee-logout"
                    onClick={handleLogout}
                >
                    🚪 Logout
                </button>

            </aside>

            {/* MAIN CONTENT */}

            <main className="employee-main">

                <header className="employee-header">

                    <div>
                        <h1>{activePage}</h1>
                        <p>Employee Portal / {activePage}</p>
                    </div>

                    <div className="employee-header-user">
                        <NotificationCenter
                            employee
                            onNavigate={setActivePage}
                        />
                        <div>
                            <strong>{profile.name}</strong>
                            <small>{profile.role}</small>
                        </div>

                        {profilePhotoUrl
                            ? <img className="employee-avatar employee-header-photo" src={profilePhotoUrl} alt="" />
                            : <span className="employee-avatar">{profile.name?.charAt(0).toUpperCase()}</span>}
                    </div>

                </header>

                <div className="employee-page-content">
                    {renderPage()}
                </div>

            </main>

        </div>
    );
}

export default EmployeeDashboard;
