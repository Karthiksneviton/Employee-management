import { useEffect, useState } from "react";
import {
    getEmployeeProfileChangeRequests,
    submitEmployeeProfileChangeRequest
} from "../services/hrService";
import "./HrPages.css";

const fields = [
    { name: "first_name", label: "First name" },
    { name: "last_name", label: "Last name" },
    { name: "email", label: "Email address", type: "email" },
    { name: "phone", label: "Phone" },
    { name: "date_of_birth", label: "Date of birth", type: "date" },
    { name: "gender", label: "Gender", type: "gender" },
    { name: "address", label: "Address" },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "country", label: "Country" },
    { name: "emergency_contact_name", label: "Emergency contact name" },
    { name: "emergency_contact_relationship", label: "Relationship" },
    { name: "emergency_contact_phone", label: "Emergency contact phone" },
    { name: "emergency_contact_email", label: "Emergency contact email", type: "email" }
];

function EmployeeProfileCorrection({ profile }) {
    const [requests, setRequests] = useState([]);
    const [changes, setChanges] = useState({});
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const hasPendingRequest = requests.some(item => item.status === "pending");

    useEffect(() => {
        let active = true;
        getEmployeeProfileChangeRequests()
            .then(data => {
                if (active) setRequests(data.requests);
            })
            .catch(loadError => {
                if (active) setError(loadError.message || "Unable to load profile requests");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setMessage("");
        const requestedChanges = Object.fromEntries(
            Object.entries(changes)
                .filter(([, value]) => value.trim())
                .map(([field, value]) => [field, value.trim()])
        );
        if (!Object.keys(requestedChanges).length) {
            setError("Enter at least one updated profile value.");
            return;
        }

        try {
            setSaving(true);
            const result = await submitEmployeeProfileChangeRequest(requestedChanges, reason);
            setRequests(current => [result.request, ...current]);
            setChanges({ name: "", email: "", role: "", department: "" });
            setReason("");
            setMessage("Your request has been sent to an administrator for review.");
        } catch (submitError) {
            setError(submitError.message || "Unable to submit profile request");
            setSaving(false);
            return;
        }
        try {
            const data = await getEmployeeProfileChangeRequests();
            setRequests(data.requests);
        } catch (refreshError) {
            setError(`Your request was submitted, but the list could not be refreshed: ${refreshError.message}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="hr-page employee-profile-requests">
            <header className="hr-page-header">
                <div>
                    <h2>Request a Profile Correction</h2>
                    <p>Changes are reviewed by an administrator before your profile is updated.</p>
                </div>
            </header>

            {hasPendingRequest && (
                <p className="hr-alert success" role="status">
                    Your pending request must be reviewed before you can submit another one.
                </p>
            )}
            <form className="hr-form hr-card" onSubmit={handleSubmit}>
                {fields.map(field => (
                    <label key={field.name}>
                        {field.label}
                        {field.type === "gender" ? (
                            <select
                                value={changes[field.name] || ""}
                                onChange={event => setChanges(current => ({
                                    ...current,
                                    [field.name]: event.target.value
                                }))}
                            >
                                <option value="">No change</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="non_binary">Non-binary</option>
                                <option value="prefer_not_to_say">Prefer not to say</option>
                                <option value="self_described">Self-described</option>
                            </select>
                        ) : (
                            <input
                                type={field.type || "text"}
                                maxLength={field.type === "email" ? 150 : 500}
                                value={changes[field.name] || ""}
                                placeholder={`Current: ${profile[field.name] || "Not set"}`}
                                onChange={event => setChanges(current => ({
                                    ...current,
                                    [field.name]: event.target.value
                                }))}
                            />
                        )}
                    </label>
                ))}
                <label className="hr-form-wide">
                    Reason for correction
                    <textarea
                        rows="3"
                        maxLength={1000}
                        value={reason}
                        onChange={event => setReason(event.target.value)}
                        required
                    />
                </label>
                <button type="submit" disabled={saving || hasPendingRequest}>
                    {saving ? "Submitting..." : "Submit for review"}
                </button>
            </form>

            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {message && <p className="hr-alert success" role="status">{message}</p>}

            <section className="hr-card">
                <h3>My Profile Requests</h3>
                {loading ? <p>Loading requests...</p> : requests.length === 0 ? (
                    <p>You have not submitted any profile correction requests.</p>
                ) : (
                    <div className="hr-table-wrap">
                        <table>
                            <thead>
                                <tr><th>Requested changes</th><th>Reason</th><th>Status</th><th>Admin response</th></tr>
                            </thead>
                            <tbody>
                                {requests.map(item => (
                                    <tr key={item.id}>
                                        <td>
                                            {Object.entries(item.requested_changes).map(([field, value]) => (
                                                <div key={field}><strong>{field}:</strong> {value}</div>
                                            ))}
                                        </td>
                                        <td>{item.reason}</td>
                                        <td><span className={`hr-status ${item.status}`}>{item.status}</span></td>
                                        <td>{item.admin_notes || "—"}</td>
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

export default EmployeeProfileCorrection;
