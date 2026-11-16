
import { useEffect, useState } from "react";

import {
    getTodayAttendance,
    employeeCheckIn,
    employeeCheckOut,
    getAttendanceHistory
} from "../services/employeeAttendanceService";

import "./EmployeeAttendance.css";
import { ATTENDANCE_STATUSES, getStatusLabel } from "../utils/statusOptions.js";

function EmployeeAttendance() {

    const [today, setToday] = useState(null);
    const [history, setHistory] = useState([]);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    async function loadAttendance() {

        try {

            setLoading(true);
            setError("");

            const [todayData, historyData] = await Promise.all([
                getTodayAttendance(),
                getAttendanceHistory(page, 10)
            ]);

            setToday(todayData.attendance);

            setHistory(historyData.attendance);

            setTotalPages(
                Math.max(1, historyData.pagination.totalPages)
            );

        } catch (err) {

            setError(err.message);

        } finally {

            setLoading(false);

        }
    }

    useEffect(() => {
        loadAttendance();
    }, [page]);

    async function handleCheckIn() {

        try {

            setSubmitting(true);
            setError("");
            setSuccess("");

            const data = await employeeCheckIn();

            setSuccess(data.message);

            await loadAttendance();

        } catch (err) {

            setError(err.message);

        } finally {

            setSubmitting(false);

        }
    }

    async function handleCheckOut() {

        try {

            setSubmitting(true);
            setError("");
            setSuccess("");

            const data = await employeeCheckOut();

            setSuccess(data.message);

            await loadAttendance();

        } catch (err) {

            setError(err.message);

        } finally {

            setSubmitting(false);

        }
    }

    function formatTime(value) {

        if (!value) return "--";

        return new Date(value).toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata"
            }
        );
    }

    function formatDate(value) {

        if (!value) return "--";

        // PostgreSQL DATE values should be parsed as local
        // calendar dates rather than UTC midnight.
        const date = String(value).slice(0, 10);
        const [year, month, day] = date.split("-");

        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        ).toLocaleDateString("en-IN");
    }

    function formatWorkingMinutes(minutes) {

        if (minutes === null || minutes === undefined) {
            return "--";
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        return `${hours}h ${remainingMinutes}m`;
    }

    if (loading) {
        return (
            <div className="attendance-loading">
                Loading attendance...
            </div>
        );
    }

    const checkedIn = Boolean(today?.check_in);
    const checkedOut = Boolean(today?.check_out);

    return (

        <div className="attendance-page">

            <div className="attendance-heading">

                <div>
                    <h2>My Attendance</h2>
                    <p>Track your daily attendance and working hours.</p>
                </div>

                <button
                    className="attendance-refresh"
                    onClick={loadAttendance}
                    disabled={submitting}
                >
                    ↻ Refresh
                </button>

            </div>

            {error && (
                <div className="attendance-error" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="attendance-success" role="status">
                    {success}
                </div>
            )}

            {/* TODAY'S ATTENDANCE */}

            <section className="attendance-today">

                <h3>Today's Attendance</h3>

                <p className="attendance-date">
                    {new Date().toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "Asia/Kolkata"
                    })}
                </p>

                <div className="attendance-stats">

                    <div className="attendance-stat">
                        <span>Check In</span>
                        <h2>{formatTime(today?.check_in)}</h2>
                    </div>

                    <div className="attendance-stat">
                        <span>Check Out</span>
                        <h2>{formatTime(today?.check_out)}</h2>
                    </div>

                    <div className="attendance-stat">
                        <span>Working Hours</span>
                        <h2>
                            {formatWorkingMinutes(
                                today?.total_working_minutes
                            )}
                        </h2>
                    </div>

                </div>

                <div className="attendance-actions">

                    <button
                        className="checkin-btn"
                        onClick={handleCheckIn}
                        disabled={submitting || Boolean(today)}
                    >
                        {submitting
                            ? "Please wait..."
                            : "✓ Check In"}
                    </button>

                    <button
                        className="checkout-btn"
                        onClick={handleCheckOut}
                        disabled={
                            submitting ||
                            !checkedIn ||
                            checkedOut
                        }
                    >
                        ↗ Check Out
                    </button>

                </div>

                <p className="attendance-status">
                    Status: {today
                        ? getStatusLabel(
                            ATTENDANCE_STATUSES,
                            today.status === "incomplete" ? "present" : today.status
                        )
                        : "Not checked in"}
                </p>

            </section>

            {/* ATTENDANCE HISTORY */}

            <section className="attendance-history">

                <h3>Attendance History</h3>

                {history.length === 0 ? (

                    <p>No attendance records found.</p>

                ) : (

                    <div className="attendance-table-wrapper">

                        <table>

                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Check In</th>
                                    <th>Check Out</th>
                                    <th>Working Hours</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>

                                {history.map(record => (

                                    <tr key={record.id}>

                                        <td>
                                            {formatDate(record.attendance_date)}
                                        </td>

                                        <td>
                                            {formatTime(record.check_in)}
                                        </td>

                                        <td>
                                            {formatTime(record.check_out)}
                                        </td>

                                        <td>
                                            {formatWorkingMinutes(
                                                record.total_working_minutes
                                            )}
                                        </td>

                                        <td>
                                            <span className={
                                                `attendance-badge ${record.status === "incomplete" ? "present" : record.status}`
                                            }>
                                                {getStatusLabel(
                                                    ATTENDANCE_STATUSES,
                                                    record.status === "incomplete" ? "present" : record.status
                                                )}
                                            </span>
                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                )}

                <div className="attendance-pagination">

                    <button
                        disabled={page === 1}
                        onClick={() => setPage(prev => prev - 1)}
                    >
                        Previous
                    </button>

                    <span>
                        Page {page} of {totalPages}
                    </span>

                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(prev => prev + 1)}
                    >
                        Next
                    </button>

                </div>

            </section>

        </div>
    );
}

export default EmployeeAttendance;
