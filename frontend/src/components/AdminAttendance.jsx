import { useCallback, useEffect, useState } from "react";
import { saveAttendance, getAdminAttendance } from "../services/hrService";
import { ATTENDANCE_STATUSES } from "../utils/statusOptions.js";
import "./HrPages.css";

function todayInIndia() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function toLocalDateTime(value) {
    if (!value) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function AdminAttendance() {
    const [date, setDate] = useState(todayInIndia);
    const [records, setRecords] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadRecords = useCallback(async () => {
        try {
            const data = await getAdminAttendance(date, page);
            setRecords(data.attendance);
            setPagination(data.pagination);
            setDrafts({});
        } catch (err) {
            setError(err.message || "Unable to load attendance");
        } finally {
            setLoading(false);
        }
    }, [date, page]);

    useEffect(() => {
        let active = true;
        getAdminAttendance(date, page)
            .then(data => {
                if (!active) return;
                setRecords(data.attendance);
                setPagination(data.pagination);
                setDrafts({});
            })
            .catch(err => {
                if (active) setError(err.message || "Unable to load attendance");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [date, page]);

    async function saveCorrection(item) {
        const draft = drafts[item.employee_id] || {};
        const checkIn = draft.checkIn ?? toLocalDateTime(item.check_in);
        const checkOut = draft.checkOut ?? toLocalDateTime(item.check_out);
        setSavingId(item.employee_id);
        setError("");
        setMessage("");
        try {
            const status = draft.status ?? item.status;
            const timeEntryStatus = status === "present" || status === "late";
            await saveAttendance({
                employeeId: item.employee_id,
                attendanceDate: date,
                checkIn: timeEntryStatus ? checkIn || null : null,
                checkOut: timeEntryStatus ? checkOut || null : null,
                status
            });
            setMessage(`Attendance updated for ${item.name}.`);
            await loadRecords();
        } catch (err) {
            setError(err.message || "Unable to update attendance");
        } finally {
            setSavingId(null);
        }
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Attendance Management</h2>
                    <p>Review and correct employee check-in/out records.</p>
                </div>
                <label className="hr-date-filter">
                    Attendance date
                    <input type="date" value={date} onChange={event => {
                        setLoading(true);
                        setError("");
                        setDate(event.target.value);
                        setPage(1);
                    }} />
                </label>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {message && <p className="hr-alert success" role="status">{message}</p>}
            {loading ? <p>Loading attendance...</p> : records.length === 0 ? (
                <div className="hr-card"><p>No attendance records for this date.</p></div>
            ) : (
                <div className="hr-table-wrap hr-card">
                    <table>
                        <thead>
                            <tr><th>Employee</th><th>Department</th><th>Check in (IST)</th><th>Check out (IST)</th><th>Worked</th><th>Status</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {records.map(item => {
                                const draft = drafts[item.employee_id] || {};
                                return (
                                    <tr key={item.employee_id}>
                                        <td>{item.name}<small className="hr-subtext">{item.email}</small></td>
                                        <td>{item.department}</td>
                                        <td>
                                            <input type="datetime-local" min={`${date}T00:00`} max={`${date}T23:59`} aria-label={`Check-in time for ${item.name}`} value={draft.checkIn ?? toLocalDateTime(item.check_in)} disabled={["absent", "leave", "holiday"].includes(draft.status ?? item.status)} onChange={event => setDrafts(current => ({ ...current, [item.employee_id]: { ...current[item.employee_id], checkIn: event.target.value } }))} />
                                        </td>
                                        <td>
                                            <input type="datetime-local" min={`${date}T00:00`} max={`${date}T23:59`} aria-label={`Check-out time for ${item.name}`} value={draft.checkOut ?? toLocalDateTime(item.check_out)} disabled={["absent", "leave", "holiday"].includes(draft.status ?? item.status)} onChange={event => setDrafts(current => ({ ...current, [item.employee_id]: { ...current[item.employee_id], checkOut: event.target.value } }))} />
                                        </td>
                                        <td>{item.total_working_minutes == null ? "—" : `${Math.floor(item.total_working_minutes / 60)}h ${item.total_working_minutes % 60}m`}</td>
                                        <td>
                                            <select className={`hr-status ${draft.status ?? item.status}`} aria-label={`Attendance status for ${item.name}`} value={draft.status ?? item.status} onChange={event => setDrafts(current => ({ ...current, [item.employee_id]: { ...current[item.employee_id], status: event.target.value } }))}>
                                                {ATTENDANCE_STATUSES.map(status => (
                                                    <option key={status.value} value={status.value}>{status.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td><button disabled={savingId === item.employee_id} onClick={() => saveCorrection(item)}>{savingId === item.employee_id ? "Saving..." : "Save"}</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="hr-pagination">
                <span>{pagination.total} records · Page {page} of {Math.max(1, pagination.totalPages)}</span>
                <div>
                    <button disabled={page <= 1} onClick={() => {
                        setLoading(true);
                        setPage(current => current - 1);
                    }}>Previous</button>
                    <button disabled={page >= pagination.totalPages} onClick={() => {
                        setLoading(true);
                        setPage(current => current + 1);
                    }}>Next</button>
                </div>
            </div>
        </section>
    );
}

export default AdminAttendance;
