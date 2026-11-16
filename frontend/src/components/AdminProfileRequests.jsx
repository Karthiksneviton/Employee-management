import { useEffect, useState } from "react";
import {
    getAdminProfileChangeRequests,
    reviewAdminProfileChangeRequest
} from "../services/hrService";
import "./HrPages.css";

function AdminProfileRequests() {
    const [requests, setRequests] = useState([]);
    const [status, setStatus] = useState("pending");
    const [notes, setNotes] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        getAdminProfileChangeRequests(status)
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
    }, [status]);

    async function review(item, decision) {
        setSavingId(item.id);
        setError("");
        setMessage("");
        try {
            const result = await reviewAdminProfileChangeRequest(item.id, decision, notes[item.id] || "");
            setMessage(`Profile request ${decision}.`);
            setRequests(current => current.map(request =>
                request.id === item.id ? { ...request, ...result.request } : request
            ));
        } catch (reviewError) {
            setError(reviewError.message || "Unable to review profile request");
            setSavingId(null);
            return;
        }
        try {
            const data = await getAdminProfileChangeRequests(status);
            setRequests(data.requests);
        } catch (refreshError) {
            setError(`The request was reviewed, but the list could not be refreshed: ${refreshError.message}`);
        } finally {
            setSavingId(null);
        }
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Profile Change Requests</h2>
                    <p>Review employee-submitted corrections before they update official records.</p>
                </div>
                <select
                    aria-label="Filter profile requests"
                    value={status}
                    onChange={event => {
                        setLoading(true);
                        setError("");
                        setStatus(event.target.value);
                    }}
                >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="">All</option>
                </select>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {message && <p className="hr-alert success" role="status">{message}</p>}
            {loading ? <p>Loading profile requests...</p> : requests.length === 0 ? (
                <div className="hr-card"><p>No profile requests match this filter.</p></div>
            ) : (
                <div className="hr-table-wrap hr-card">
                    <table>
                        <thead>
                            <tr><th>Employee</th><th>Requested changes</th><th>Reason</th><th>Status</th><th>Review</th></tr>
                        </thead>
                        <tbody>
                            {requests.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}<small className="hr-subtext">{item.email} · {item.department}</small></td>
                                    <td>
                                        {Object.entries(item.requested_changes).map(([field, value]) => (
                                            <div key={field}><strong>{field}:</strong> {value}</div>
                                        ))}
                                    </td>
                                    <td>{item.reason}</td>
                                    <td><span className={`hr-status ${item.status}`}>{item.status}</span></td>
                                    <td>
                                        {item.status === "pending" ? (
                                            <div className="hr-review-controls">
                                                <input
                                                    aria-label={`Notes for ${item.name}`}
                                                    placeholder="Optional notes"
                                                    maxLength={1000}
                                                    value={notes[item.id] || ""}
                                                    onChange={event => setNotes(current => ({
                                                        ...current,
                                                        [item.id]: event.target.value
                                                    }))}
                                                />
                                                <button disabled={savingId === item.id} onClick={() => review(item, "approved")}>Approve</button>
                                                <button className="secondary" disabled={savingId === item.id} onClick={() => review(item, "rejected")}>Reject</button>
                                            </div>
                                        ) : item.admin_notes || "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export default AdminProfileRequests;
