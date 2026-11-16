import { useEffect, useState } from "react";
import { getEmployeeAnnouncements } from "../services/hrService";
import "./HrPages.css";

function EmployeeAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getEmployeeAnnouncements()
            .then(data => setAnnouncements(data.announcements))
            .catch(err => setError(err.message || "Unable to load announcements"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="hr-page">
            <header className="hr-page-header">
                <div>
                    <h2>Announcements</h2>
                    <p>Updates shared by your HR administrator.</p>
                </div>
            </header>
            {error && <p className="hr-alert error" role="alert">{error}</p>}
            {loading ? <p>Loading announcements...</p> : announcements.length === 0 ? (
                <div className="hr-card"><p>No announcements have been published.</p></div>
            ) : announcements.map(item => (
                <article className="hr-card announcement-card" key={item.id}>
                    <h3>{item.title}</h3>
                    <time>{new Date(item.created_at).toLocaleDateString()}</time>
                    <p>{item.body}</p>
                </article>
            ))}
        </section>
    );
}

export default EmployeeAnnouncements;
