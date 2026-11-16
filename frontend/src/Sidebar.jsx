import "./Sidebar.css";
import logo from "./image/logo.png";

function Sidebar({ activePage, setActivePage, admin }) {
  const navigation = [
    {
      name: "Dashboard",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      name: "Employees",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M16 20V18C16 15.79 14.21 14 12 14H7C4.79 14 3 15.79 3 18V20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle
            cx="9.5"
            cy="7"
            r="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M17 11C18.66 11 20 9.66 20 8C20 6.34 18.66 5 17 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M21 20V18C21 16.34 19.66 15 18 15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    },
    {
      name: "Employee Accounts",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="m16 11 2 2 3.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      name: "Profile Changes",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      name: "Attendance",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M7 3v4M17 3v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    },
    {
      name: "Leave Requests",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M14 3v5h5M8 13h8M8 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    },
    {
      name: "Announcements",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M4 13V8a2 2 0 0 1 2-2h3l8-3v17l-8-3H6a2 2 0 0 1-2-2ZM9 17l1 4h3l-2-5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      name: "Departments",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 8H16M8 12H16M8 16H13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    },
    {
      name: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15.5C13.93 15.5 15.5 13.93 15.5 12C15.5 10.07 13.93 8.5 12 8.5C10.07 8.5 8.5 10.07 8.5 12C8.5 13.93 10.07 15.5 12 15.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M19.4 15C19.5 15.2 19.63 15.39 19.78 15.57L20 15.83L18 18L17.68 17.84C17.47 17.74 17.24 17.65 17 17.59C16.73 17.87 16.43 18.13 16.1 18.36C16.13 18.62 16.15 18.87 16.13 19.12L16.1 19.5H13.1L13.04 19.12C13 18.87 13 18.62 13.05 18.36C12.7 18.13 12.4 17.87 12.12 17.59C11.88 17.65 11.65 17.74 11.42 17.84L11.1 18L9.1 15.83L9.32 15.57C9.47 15.39 9.6 15.2 9.7 15C9.54 14.63 9.41 14.25 9.33 13.85C9.1 13.72 8.86 13.62 8.6 13.55L8.25 13.45V10.55L8.6 10.45C8.86 10.38 9.1 10.28 9.33 10.15C9.41 9.75 9.54 9.37 9.7 9C9.6 8.8 9.47 8.61 9.32 8.43L9.1 8.17L11.1 6L11.42 6.16C11.65 6.26 11.88 6.35 12.12 6.41C12.4 6.13 12.7 5.87 13.05 5.64C13 5.38 13 5.13 13.04 4.88L13.1 4.5H16.1L16.13 4.88C16.15 5.13 16.13 5.38 16.1 5.64C16.43 5.87 16.73 6.13 17 6.41C17.24 6.35 17.47 6.26 17.68 6.16L18 6L20 8.17L19.78 8.43C19.63 8.61 19.5 8.8 19.4 9C19.56 9.37 19.69 9.75 19.77 10.15C20 10.28 20.24 10.38 20.5 10.45L20.85 10.55V13.45L20.5 13.55C20.24 13.62 20 13.72 19.77 13.85C19.69 14.25 19.56 14.63 19.4 15Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      )
    }
  ];

  return (
    <aside className="sidebar">

      <div className="sidebar-brand">

        <div className="sidebar-logo">
          <img src={logo} alt="" />
        </div>

        <div className="sidebar-brand-text">
          <strong>EmployeeHub</strong>
          <span>HR Management</span>
        </div>

      </div>

      <div className="sidebar-section-title">
        MAIN MENU
      </div>

      <nav className="sidebar-nav">

        {navigation.map((item) => (
          <button
            key={item.name}
            className={`sidebar-nav-item ${
              activePage === item.name ? "active" : ""
            }`}
            onClick={() => setActivePage(item.name)}
          >
            <span className="sidebar-nav-icon">
              {item.icon}
            </span>

            <span>{item.name}</span>

            {activePage === item.name && (
              <span className="sidebar-active-dot"></span>
            )}
          </button>
        ))}

      </nav>

      <div className="sidebar-bottom">

        <div className="sidebar-profile">

          <div className="sidebar-avatar">
            {admin?.username?.charAt(0).toUpperCase()}
          </div>

          <div className="sidebar-profile-info">
            <strong>{admin?.username}</strong>
            <span>Administrator</span>
          </div>

        </div>

      </div>

    </aside>
  );
}

export default Sidebar;