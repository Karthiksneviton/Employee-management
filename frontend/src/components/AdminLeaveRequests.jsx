import { useCallback, useEffect, useState } from "react";
import { getAdminLeaveRequests, reviewLeaveRequest } from "../services/hrService";
import "./HrPages.css";

function AdminLeaveRequests() {
    const [requests, setRequests] = useState([]);
    const [status, setStatus] = useState("pending");
    const [notes, setNotes] = useState({});
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState("");

    const loadRequests = useCallback(async () => {
        try {
            const data = await getAdminLeaveRequests(status);
            setRequests(data.requests);
        } catch (err) {
            setError(err.message || "Unable to load leave requests");
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        let active = true;
        getAdminLeaveRequests(status)
            .then(data => {
                if (active) setRequests(data.requests);
            })
            .catch(err => {
                if (active) setError(err.message || "Unable to load leave requests");
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
        try {
            await reviewLeaveRequest(item.id, decision, notes[item.id] || "");
            await loadRequests();
        } catch (err) {
            setError(err.message || "Unable to review leave request");
        } finally {
            setSavingId(null);
        }
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Leave Requests</h2>
                    <p>Review and respond to employee requests.</p>
                </div>
                <select aria-label="Filter leave requests" value={status} onChange={event => {
                    setLoading(true);
                    setError("");
                    setStatus(event.target.value);
                }}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="">All</option>
                </select>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {loading ? <p>Loading requests...</p> : requests.length === 0 ? (
                <div className="hr-card"><p>No requests match this filter.</p></div>
            ) : (
                <div className="hr-table-wrap hr-card">
                    <table>
                        <thead>
                            <tr><th>Employee</th><th>Dates</th><th>Reason</th><th>Status</th><th>Review</th></tr>
                        </thead>
                        <tbody>
                            {requests.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}<small className="hr-subtext">{item.email} · {item.department}</small></td>
                                    <td>{String(item.start_date).slice(0, 10)} – {String(item.end_date).slice(0, 10)}</td>
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
                                                    onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))}
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

export default AdminLeaveRequests;
