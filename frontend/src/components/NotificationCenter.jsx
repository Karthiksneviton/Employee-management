import { useCallback, useEffect, useState } from "react";
import { getNotifications, markNotificationRead } from "../services/hrService";
import "./NotificationCenter.css";

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleString();
}

function NotificationCenter({ employee = false, onNavigate }) {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        try {
            const data = await getNotifications(employee);
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
            setError("");
        } catch (requestError) {
            setError(requestError.message || "Unable to load notifications");
        } finally {
            setLoading(false);
        }
    }, [employee]);

    useEffect(() => {
        const initialLoad = window.setTimeout(refresh, 0);
        const interval = window.setInterval(refresh, 60000);
        const onFocus = () => refresh();
        window.addEventListener("focus", onFocus);
        return () => {
            window.clearTimeout(initialLoad);
            window.clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, [refresh]);

    async function handleRead(notification) {
        try {
            if (!notification.read_at) {
                await markNotificationRead(notification.id, employee);
                await refresh();
            }
            const destinations = employee
                ? {
                    leave_request: "Leave",
                    profile_change_request: "Profile",
                    announcement: "Announcements"
                }
                : {
                    leave_request: "Leave Requests",
                    profile_change_request: "Profile Changes"
                };
            const destination = destinations[notification.entity_type];
            if (destination) onNavigate?.(destination);
            setOpen(false);
        } catch (requestError) {
            setError(requestError.message || "Unable to update notifications");
        }
    }

    async function handleMarkAllRead() {
        try {
            await markNotificationRead(undefined, employee);
            await refresh();
        } catch (requestError) {
            setError(requestError.message || "Unable to update notifications");
        }
    }

    return (
        <div className="notification-center">
            <button
                type="button"
                className="notification-toggle"
                aria-label={`Notifications, ${unreadCount} unread`}
                aria-expanded={open}
                aria-controls="notification-panel"
                onClick={() => {
                    setOpen(value => !value);
                    refresh();
                }}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notification-count">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <section
                    className="notification-panel"
                    id="notification-panel"
                    aria-label="Notifications"
                >
                    <div className="notification-heading">
                        <div>
                            <h2>Notifications</h2>
                            <span>{unreadCount} unread</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            disabled={!unreadCount}
                        >
                            Mark all read
                        </button>
                    </div>
                    {error && <p className="notification-error" role="alert">{error}</p>}
                    {loading ? (
                        <p className="notification-empty">Loading notifications...</p>
                    ) : notifications.length ? (
                        <ul>
                            {notifications.map(notification => (
                                <li key={notification.id}>
                                    <button
                                        type="button"
                                        className={`notification-item ${notification.read_at ? "read" : "unread"}`}
                                        onClick={() => handleRead(notification)}
                                    >
                                        <strong>{notification.title}</strong>
                                        <span>{notification.message}</span>
                                        <time dateTime={notification.created_at}>
                                            {formatDate(notification.created_at)}
                                        </time>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="notification-empty">You're all caught up.</p>
                    )}
                </section>
            )}
        </div>
    );
}

export default NotificationCenter;
