import { useEffect, useState } from "react";
import {
    changeAdminPassword,
    getAdminAuditLogs,
    getAdminSettings
} from "../services/hrService";
import "./HrPages.css";

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function AdminSettings({ admin, darkMode, setDarkMode, onLogout }) {
    const [account, setAccount] = useState(admin || {});
    const [accountError, setAccountError] = useState("");
    const [events, setEvents] = useState([]);
    const [auditError, setAuditError] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordMessage, setPasswordMessage] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        let active = true;
        getAdminSettings()
            .then(data => {
                if (active) setAccount(data.admin);
            })
            .catch(error => {
                if (active) setAccountError(error.message || "Unable to load account details");
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        getAdminAuditLogs()
            .then(data => {
                if (active) setEvents(data.events);
            })
            .catch(error => {
                if (active) setAuditError(error.message || "Unable to load account activity");
            });
        return () => {
            active = false;
        };
    }, []);

    async function handlePasswordChange(event) {
        event.preventDefault();
        setPasswordError("");
        setPasswordMessage("");

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match");
            return;
        }
        if (newPassword.length < 12 || new TextEncoder().encode(newPassword).length > 72) {
            setPasswordError("New password must contain at least 12 characters and no more than 72 bytes");
            return;
        }

        try {
            setSavingPassword(true);
            const result = await changeAdminPassword(currentPassword, newPassword);
            setPasswordMessage(result.message);
            setAccount(current => ({
                ...current,
                sessionExpiresAt: result.sessionExpiresAt
            }));
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            try {
                setAuditError("");
                const data = await getAdminAuditLogs();
                setEvents(data.events);
            } catch (error) {
                setAuditError(error.message || "Unable to refresh account activity");
            }
        } catch (error) {
            setPasswordError(error.message || "Unable to change password");
        } finally {
            setSavingPassword(false);
        }
    }

    return (
        <section className="profile-page">
            <div className="profile-heading">
                <h2>Account Settings</h2>
                <p>Manage your administrator account and security.</p>
            </div>

            <div className="profile-card">
                <div className="profile-top">
                    <div className="profile-avatar-large">
                        {account.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2>{account.username || admin?.username}</h2>
                        <p>HR Portal Administrator</p>
                        <span className={`profile-status ${account.status === "active" ? "" : "inactive"}`}>
                            {account.status || "Loading status"}
                        </span>
                    </div>
                </div>

                {accountError && <p className="hr-alert error" role="alert">{accountError}</p>}

                <div className="profile-divider"></div>
                <div className="profile-details">
                    <div className="profile-detail-item">
                        <span>Username</span>
                        <strong>{account.username || admin?.username || "—"}</strong>
                    </div>
                    <div className="profile-detail-item">
                        <span>Account Role</span>
                        <strong>{(account.role || admin?.role || "—").toUpperCase()}</strong>
                    </div>
                    <div className="profile-detail-item">
                        <span>Account Status</span>
                        <strong>{account.status || "Loading"}</strong>
                    </div>
                    <div className="profile-detail-item">
                        <span>Last Login</span>
                        <strong>{formatDate(account.lastLoginAt || account.last_login_at)}</strong>
                    </div>
                    <div className="profile-detail-item">
                        <span>Current Session Expires</span>
                        <strong>{formatDate(account.sessionExpiresAt)}</strong>
                    </div>
                </div>

                <div className="settings-option">
                    <div>
                        <h3>Appearance</h3>
                        <p>Switch between light and dark mode for the HR dashboard.</p>
                    </div>
                    <button
                        type="button"
                        className={`theme-toggle ${darkMode ? "active" : ""}`}
                        onClick={() => setDarkMode(previous => !previous)}
                        aria-label="Toggle dark mode"
                        aria-pressed={darkMode}
                    >
                        <span className="theme-toggle-icon">{darkMode ? "☀️" : "🌙"}</span>
                        <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>
                    </button>
                </div>

                <section className="settings-password">
                    <h3>Change Password</h3>
                    <p>Use a unique password with at least 12 characters. Changing it signs out other administrator sessions.</p>
                    <form className="hr-form" onSubmit={handlePasswordChange}>
                        <label className="hr-form-wide">
                            Current password
                            <input
                                type={showPasswords ? "text" : "password"}
                                autoComplete="current-password"
                                value={currentPassword}
                                maxLength={72}
                                onChange={event => setCurrentPassword(event.target.value)}
                                required
                            />
                        </label>
                        <label>
                            New password
                            <input
                                type={showPasswords ? "text" : "password"}
                                autoComplete="new-password"
                                value={newPassword}
                                minLength={12}
                                maxLength={72}
                                onChange={event => setNewPassword(event.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Confirm new password
                            <input
                                type={showPasswords ? "text" : "password"}
                                autoComplete="new-password"
                                value={confirmPassword}
                                minLength={12}
                                maxLength={72}
                                onChange={event => setConfirmPassword(event.target.value)}
                                required
                            />
                        </label>
                        <label className="settings-show-password">
                            <input
                                type="checkbox"
                                checked={showPasswords}
                                onChange={event => setShowPasswords(event.target.checked)}
                            />
                            Show passwords
                        </label>
                        <button type="submit" disabled={savingPassword}>
                            {savingPassword ? "Changing..." : "Change password"}
                        </button>
                    </form>
                    {passwordError && <p className="hr-alert error" role="alert">{passwordError}</p>}
                    {passwordMessage && <p className="hr-alert success" role="status">{passwordMessage}</p>}
                </section>

                <button className="profile-logout" onClick={onLogout}>
                    Logout from Account
                </button>
            </div>

            <section className="hr-card">
                <h3>Recent Account Activity</h3>
                <p>Security and profile-change events recorded by the HR system.</p>
                {auditError && <p className="hr-alert error" role="alert">{auditError}</p>}
                {events.length === 0 && !auditError ? (
                    <p>No account activity has been recorded yet.</p>
                ) : (
                    <div className="hr-table-wrap">
                        <table>
                            <thead>
                                <tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr>
                            </thead>
                            <tbody>
                                {events.map(item => (
                                    <tr key={item.id}>
                                        <td>{formatDate(item.created_at)}</td>
                                        <td>{item.actor_type} #{item.actor_id ?? "—"}</td>
                                        <td>{item.action}</td>
                                        <td><code>{JSON.stringify(item.details)}</code></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    );
}

export default AdminSettings;
