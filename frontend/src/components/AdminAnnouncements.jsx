import { useCallback, useEffect, useState } from "react";
import {
    archiveAnnouncement,
    getAdminAnnouncements,
    publishAnnouncement
} from "../services/hrService";
import "./HrPages.css";

function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadAnnouncements = useCallback(async () => {
        try {
            const data = await getAdminAnnouncements();
            setAnnouncements(data.announcements);
        } catch (err) {
            setError(err.message || "Unable to load announcements");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;
        getAdminAnnouncements()
            .then(data => {
                if (active) setAnnouncements(data.announcements);
            })
            .catch(err => {
                if (active) setError(err.message || "Unable to load announcements");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    async function handlePublish(event) {
        event.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");
        try {
            await publishAnnouncement(title, body);
            setTitle("");
            setBody("");
            setMessage("Announcement published.");
            await loadAnnouncements();
        } catch (err) {
            setError(err.message || "Unable to publish announcement");
        } finally {
            setSaving(false);
        }
    }

    async function handleArchive(item) {
        if (!window.confirm(`Archive "${item.title}"?`)) return;
        setError("");
        try {
            await archiveAnnouncement(item.id);
            await loadAnnouncements();
        } catch (err) {
            setError(err.message || "Unable to archive announcement");
        }
    }

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Announcements</h2>
                    <p>Publish updates for employees and archive old posts.</p>
                </div>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {message && <p className="hr-alert success" role="status">{message}</p>}
            <form className="hr-form" onSubmit={handlePublish}>
                <label className="hr-form-wide">
                    Title
                    <input value={title} onChange={event => setTitle(event.target.value)} maxLength={150} required />
                </label>
                <label className="hr-form-wide">
                    Announcement
                    <textarea value={body} onChange={event => setBody(event.target.value)} maxLength={5000} rows={5} required />
                </label>
                <button disabled={saving}>{saving ? "Publishing..." : "Publish announcement"}</button>
            </form>
            <section className="hr-card">
                <h3>All announcements</h3>
                {loading ? <p>Loading announcements...</p> : announcements.length === 0 ? (
                    <p>No announcements yet.</p>
                ) : announcements.map(item => (
                    <article className="announcement-card" key={item.id}>
                        <div className="hr-page-header">
                            <h4>{item.title}</h4>
                            <span className={`hr-status ${item.status}`}>{item.status}</span>
                        </div>
                        <time>{new Date(item.created_at).toLocaleString()}</time>
                        <p>{item.body}</p>
                        {item.status === "published" && (
                            <button className="secondary" onClick={() => handleArchive(item)}>Archive</button>
                        )}
                    </article>
                ))}
            </section>
        </section>
    );
}

export default AdminAnnouncements;
