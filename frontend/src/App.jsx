import { useState, useEffect, useMemo, useCallback } from "react";
import EmployeeDashboard from "./EmployeeDashboard.jsx";
import { logoutEmployee } from "./services/employeeAuthService";
import {
  getToken,
  logoutAdmin,
  getDashboardStats
} from "./services/employeeService";

import Sidebar from "./Sidebar.jsx";
import Login from "./Login.jsx";
import EmployeeAccounts from "./components/EmployeeAccounts.jsx";
import AdminEmployees from "./components/AdminEmployees.jsx";
import AdminAttendance from "./components/AdminAttendance.jsx";
import AdminLeaveRequests from "./components/AdminLeaveRequests.jsx";
import AdminAnnouncements from "./components/AdminAnnouncements.jsx";
import AdminProfileRequests from "./components/AdminProfileRequests.jsx";
import AdminSettings from "./components/AdminSettings.jsx";
import NotificationCenter from "./components/NotificationCenter.jsx";
import "./App.css";
import "./Login.css";

function App() {
  // Dark mode
const [darkMode, setDarkMode] = useState(() => {
  return localStorage.getItem("hr_dark_mode") === "true";
});

useEffect(() => {
  document.body.classList.toggle("dark-mode", darkMode);
  localStorage.setItem("hr_dark_mode", darkMode);
}, [darkMode]);

  // Authentication
  const [token, setToken] = useState(getToken());

  const [admin, setAdmin] = useState(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("admin_user")
      );
    } catch {
      return null;
    }
  });
// Employee authentication
const [employee, setEmployee] = useState(() => {
    try {
        if (!sessionStorage.getItem("employee_token")) {
            return null;
        }

        return JSON.parse(
            sessionStorage.getItem("employee_user")
        );
    } catch {
        return null;
    }
});
  // Navigation
  const [activePage, setActivePage] = useState("Dashboard");

  // Dashboard
  const [dashboard, setDashboard] = useState(null);

  // Loading states
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Notifications
  const [error, setError] = useState("");

  // Login
  function handleLogin(adminData) {
    setAdmin(adminData);
    setToken(getToken());
  }

  // Logout
  function handleLogout() {
    logoutAdmin();

    setAdmin(null);
    setToken(null);
    setDashboard(null);
    setActivePage("Dashboard");
  }

function handleEmployeeLogin(employeeData) {
    setEmployee(employeeData);
}

const handleEmployeeLogout = useCallback(() => {
    logoutEmployee();
    setEmployee(null);
}, []);
  // Authentication expiration
  useEffect(() => {

    function handleAuthExpired() {
      setToken(null);
      setAdmin(null);
      setDashboard(null);
    }

    window.addEventListener(
      "admin-auth-expired",
      handleAuthExpired
    );

    return () => {
      window.removeEventListener(
        "admin-auth-expired",
        handleAuthExpired
      );
    };

  }, []);

  // Load dashboard statistics
  const loadDashboard = useCallback(async () => {

    if (admin?.role !== "admin") return;

    try {
      setDashboardLoading(true);

      const data = await getDashboardStats();

      setDashboard(data);

    } catch (err) {

      setError(
        err.message || "Unable to load dashboard"
      );

    } finally {
      setDashboardLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    if (!token || !admin) {
      return;
    }

    if (admin.role === "admin") {
      loadDashboard();
    }
  }, [token, admin, loadDashboard]);


  // Department list
  const departments = useMemo(() => {
    return [
      "All",
      ...new Set(
        (dashboard?.departmentStats || [])
          .map(item => item.department)
          .filter(Boolean)
      )
    ];
  }, [dashboard]);

  // Department count
  const departmentCount = departments.length - 1;

  // Dashboard summary values
  const totalEmployees = dashboard?.totalEmployees ?? 0;

  const totalDepartments =
    dashboard?.totalDepartments ?? departmentCount;


  // Authentication check
  // Employee dashboard
if (employee) {
    return (
        <EmployeeDashboard
            employee={employee}
            onLogout={handleEmployeeLogout}
        />
    );
}

// Combined login page
if (!token || !admin) {
    return (
        <Login
            onLogin={handleLogin}
            onEmployeeLogin={handleEmployeeLogin}
        />
    );
}

  return (
    <div className="app-layout">

      {/* SIDEBAR */}

      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        admin={admin}
      />

      {/* MAIN CONTENT */}

      <main className="main-content">

        {/* TOP NAVIGATION */}

        <header className="top-navbar">

          <div>
            <h1>{activePage}</h1>

            <p>
              EmployeeHub/ {activePage}
            </p>
          </div>

          <div className="admin-header">

            <NotificationCenter onNavigate={setActivePage} />

            <span>
              Welcome, {admin.username}
            </span>

            <span className={`role-badge ${admin.role}`}>
              {admin.role?.toUpperCase()}
            </span>

            <button
              className="logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>

          </div>

        </header>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="error message" role="alert">
            {error}
          </div>
        )}

        {/* SUCCESS MESSAGE */}

        {/* DASHBOARD PAGE */}

        {activePage === "Dashboard" && (

          <div className="dashboard-page">

            <section className="dashboard-welcome">

              <h2>
                Welcome back, {admin.username}!
              </h2>

              <p>
                Here's your employee management overview.
              </p>

            </section>

            {/* DASHBOARD STATISTICS */}

            {dashboardLoading ? (

              <p>Loading dashboard statistics...</p>

            ) : (

              <div className="summary">

                <div className="card">
                  <h3>Total Employees</h3>
                  <h2>{totalEmployees}</h2>
                </div>

                <div className="card">
                  <h3>Total Departments</h3>
                  <h2>{totalDepartments}</h2>
                </div>

                <div className="card">
                 <h3>New This Month</h3>
                 <h2>{dashboard?.newThisMonth ?? 0}</h2>
                </div>

              </div>

            )}

            {/* DEPARTMENT ANALYTICS */}

            {admin.role === "admin" && (

              <section className="section">

                <h2>Department Analytics</h2>

                {dashboard?.departmentStats?.length ? (

                  <div className="department-analytics">

                    {dashboard.departmentStats.map(dept => (

                      <div
                        className="department-card"
                        key={dept.department}
                      >

                        <h3>{dept.department}</h3>

                        <h2>{dept.count}</h2>

                        <p>Employees</p>

                      </div>

                    ))}

                  </div>

                ) : (

                  <p>No department data available.</p>

                )}

              </section>

            )}

            {/* RECENT EMPLOYEES */}

            {admin.role === "admin" && (

              <section className="section">

                <h2>Recently Added Employees</h2>

                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Department</th>
                      </tr>
                    </thead>

                    <tbody>

                      {dashboard?.recentEmployees?.length ? (

                        dashboard.recentEmployees.map(employee => (

                          <tr key={employee.id}>
                            <td>{employee.name}</td>
                            <td>{employee.email}</td>
                            <td>{employee.role}</td>
                            <td>
                              <span className="department-badge">
                                {employee.department}
                             </span>
                          </td>
                          </tr>

                        ))

                      ) : (

                        <tr>
                          <td colSpan="4">
                            No recent employees found.
                          </td>
                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </section>

            )}

          </div>

        )}

       
     {activePage === "Employees" && (
       <AdminEmployees onChanged={loadDashboard} />
     )}

      {/* Departments */}
      {activePage === "Employee Accounts" && (
        <section className="section">
          <EmployeeAccounts />
        </section>
      )}

      {activePage === "Attendance" && (
        <section className="section">
          <AdminAttendance />
        </section>
      )}

      {activePage === "Leave Requests" && (
        <section className="section">
          <AdminLeaveRequests />
        </section>
      )}

      {activePage === "Profile Changes" && (
        <section className="section">
          <AdminProfileRequests />
        </section>
      )}

      {activePage === "Announcements" && (
        <section className="section">
          <AdminAnnouncements />
        </section>
      )}

      {activePage === "Departments" && (
        <section className="section">
          <div className="section-header">
            <h2>Department Management</h2>
            <p>Monitor employee distribution across departments.</p>
          </div>

          {dashboardLoading ? (
            <p>Loading departments...</p>
          ) : dashboard?.departmentStats?.length ? (
            <div className="department-analytics">
              {dashboard.departmentStats.map(dept => (
                <div
                  className="department-card"
                  key={dept.department}
                >
                  <h3>{dept.department}</h3>
                  <h2>{dept.count}</h2>
                  <p>Employees</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No department information available.</p>
          )}
        </section>
      )}
      {activePage === "Settings" && (
        <AdminSettings
          admin={admin}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onLogout={handleLogout}
        />
      )}


    </main>
  </div>
  );
}

export default App;