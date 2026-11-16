import { useState } from "react";
import { loginAdmin } from "./services/employeeService";
import { employeeLogin } from "./services/employeeAuthService";
import logo from "./image/logo.png";
import "./Login.css";


function Login({ onLogin, onEmployeeLogin }) {
    const [loginType, setLoginType] = useState("admin");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
        setError(
            loginType === "admin"
                ? "Please enter your username and password."
                : "Please enter your email and password."
        );
        return;
    }

    try {
        setLoading(true);

        if (loginType === "admin") {
            const data = await loginAdmin(
                username.trim(),
                password
            );

            onLogin(data.admin);

        } else {
            const data = await employeeLogin(
                username.trim().toLowerCase(),
                password
            );

            onEmployeeLogin(data.employee);
        }

    } catch (err) {
        setError(
            err.message || "Invalid login credentials."
        );
    } finally {
        setLoading(false);
    }
}


  return (
    <div className="login-page">

      {/* Decorative background */}
      <div className="login-bg-shape login-bg-shape-one"></div>
      <div className="login-bg-shape login-bg-shape-two"></div>

      <div className="login-container">

        {/* LEFT BRAND PANEL */}
        <section className="login-brand">

  <div className="brand-logo">
    <img
      src={logo}
      alt="EmployeeHub Logo"
    />
  </div>
          <div className="brand-content">
           
            <h1>
              EmployeeHub
             
            </h1>

            <p>
              A smarter way to manage your people,
              departments and workforce operations
              from one secure platform.
            </p>
          </div>

          <div className="brand-features">

            <div className="brand-feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 19V5M4 19H20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7 15L11 11L14 14L20 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <strong>Employee Insights</strong>
                <span>Track workforce growth</span>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3V7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 21V17H18V21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 7V11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 11H18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M6 11V15M18 11V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div>
                <strong>Department Control</strong>
                <span>Organize your workforce</span>
              </div>
            </div>

            <div className="brand-feature">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L19 6V11C19 15.5 16.2 19.4 12 21C7.8 19.4 5 15.5 5 11V6L12 3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <strong>Secure & Reliable</strong>
                <span>Protected administrator access</span>
              </div>
            </div>

          </div>

          
        </section>

        {/* LOGIN PANEL */}
        <section className="login-panel">

          <div className="login-card">

            <div className="login-card-header">

    <div className="login-icon">
        👤
    </div>

    <span className="login-eyebrow">
        {loginType === "admin"
            ? "ADMINISTRATOR ACCESS"
            : "EMPLOYEE ACCESS"}
    </span>

    <h2>Welcome back</h2>

    <p>
        Sign in to access your {
            loginType === "admin"
                ? "HR dashboard"
                : "employee dashboard"
        }
    </p>

</div>
<div className="login-tabs">

    <button
        type="button"
        className={loginType === "admin" ? "active" : ""}
        onClick={() => {
            setLoginType("admin");
            setUsername("");
            setPassword("");
            setError("");
        }}
    >
        Admin Login
    </button>

    <button
        type="button"
        className={loginType === "employee" ? "active" : ""}
        onClick={() => {
            setLoginType("employee");
            setUsername("");
            setPassword("");
            setError("");
        }}
    >
        Employee Login
    </button>

</div>

            {error && (
              <div className="login-error" role="alert">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 8V12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="12"
                    cy="16"
                    r="1"
                    fill="currentColor"
                  />
                </svg>

                <span>{error}</span>
              </div>
            )}

            <form
              className="login-form"
              onSubmit={handleSubmit}
            >

              <div className="login-field">

                <label htmlFor="username">
    {loginType === "admin" ? "Username" : "Email Address"}
</label>

<div className="login-input-wrapper">

    <input
        id="username"
        type={loginType === "admin" ? "text" : "email"}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={150}
        placeholder={
            loginType === "admin"
                ? "Enter your username"
                : "Enter your employee email"
        }
        autoComplete="username"
        required
    />

</div>

              </div>

              <div className="login-field">

                <div className="field-label-row">
                  <label htmlFor="password">
                    Password
                  </label>
                </div>

                <div className="login-input-wrapper">

                  <svg viewBox="0 0 24 24" fill="none">
                    <rect
                      x="5"
                      y="10"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="M8 10V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <circle
                      cx="12"
                      cy="15"
                      r="1"
                      fill="currentColor"
                    />
                  </svg>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    maxLength={72}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>

                </div>

              </div>

          <button
    className="login-submit"
    type="submit"
    disabled={loading}
>
    {loading ? (
        <>
            <span className="login-spinner"></span>
            Signing in...
        </>
    ) : (
        <>
            {loginType === "admin"
                ? "Admin Sign In"
                : "Employee Sign In"}

            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="M5 12H19"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <path
                    d="M13 6L19 12L13 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </>
    )}
</button>
            </form>

            <div className="secure-login">

              <div className="secure-line"></div>

              <span>
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L19 6V11C19 15.5 16.2 19.4 12 21C7.8 19.4 5 15.5 5 11V6L12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {loginType === "admin"
    ? "Secure administrator access"
    : "Secure employee access"}
              </span>

              <div className="secure-line"></div>

            </div>

          </div>

        </section>

      </div>
    </div>
  );
}

export default Login;