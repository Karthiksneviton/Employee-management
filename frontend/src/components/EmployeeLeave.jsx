import { useCallback, useEffect, useState } from "react";
import {
    getEmployeeLeaveRequests,
    submitEmployeeLeaveRequest
} from "../services/hrService";
import "./HrPages.css";

function EmployeeLeave() {
    const [requests, setRequests] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadRequests = useCallback(async () => {
        try {
            const data = await getEmployeeLeaveRequests();
            setRequests(data.requests);
        } catch (err) {
            setError(err.message || "Unable to load leave requests");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        getEmployeeLeaveRequests()
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
    }, []);

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setMessage("");
        setSubmitting(true);

        try {
            await submitEmployeeLeaveRequest({ startDate, endDate, reason });
            setStartDate("");
            setEndDate("");
            setReason("");
            setMessage("Leave request submitted for admin review.");
            await loadRequests();
        } catch (err) {
            setError(err.message || "Unable to submit leave request");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Leave Management</h2>
                    <p>Request leave and track its review status.</p>
                </div>
            </header>

            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {message && <p className="hr-alert success" role="status">{message}</p>}

            <form className="hr-form" onSubmit={handleSubmit}>
                <label>
                    Start date
                    <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required />
                </label>
                <label>
                    End date
                    <input type="date" value={endDate} min={startDate || undefined} onChange={event => setEndDate(event.target.value)} required />
                </label>
                <label className="hr-form-wide">
                    Reason
                    <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} required />
                </label>
                <button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit request"}
                </button>
            </form>

            <section className="hr-card">
                <h3>My requests</h3>
                {loading ? <p>Loading requests...</p> : requests.length === 0 ? (
                    <p>No leave requests yet.</p>
                ) : (
                    <div className="hr-table-wrap">
                        <table>
                            <thead>
                                <tr><th>Dates</th><th>Reason</th><th>Status</th><th>Admin notes</th></tr>
                            </thead>
                            <tbody>
                                {requests.map(item => (
                                    <tr key={item.id}>
                                        <td>{String(item.start_date).slice(0, 10)} – {String(item.end_date).slice(0, 10)}</td>
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

export default EmployeeLeave;
