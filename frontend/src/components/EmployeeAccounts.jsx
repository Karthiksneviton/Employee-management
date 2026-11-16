
import { useEffect, useState } from "react";

import {
    getEmployeeAccounts,
    generateEmployeePassword
} from "../services/employeeService";

function EmployeeAccounts() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [generatedPassword, setGeneratedPassword] = useState("");
    const [saving, setSaving] = useState(false);

    async function loadEmployees() {
        try {
            setLoading(true);
            setError("");

            const data = await getEmployeeAccounts();
            setEmployees(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadEmployees();
    }, []);

    function openGenerate(employee) {
        setSelectedEmployee(employee);
        setGeneratedPassword("");
        setError("");
    }

    async function handleGenerate() {
        if (!selectedEmployee) return;

        try {
            setSaving(true);
            setError("");
            setGeneratedPassword("");

            const result = await generateEmployeePassword(
                selectedEmployee.employee_id
            );

            setGeneratedPassword(result.temporaryPassword);

            await loadEmployees();

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function copyPassword() {
        try {
            await navigator.clipboard.writeText(generatedPassword);
            alert("Password copied successfully");
        } catch {
            setError("Unable to copy password. Please copy it manually.");
        }
    }

    if (loading) {
        return <p>Loading employee accounts...</p>;
    }

    return (
        <div className="employee-accounts">

            <h2>Employee Login Accounts</h2>

            <p>
                Generate a temporary password for each eligible employee who
                needs dashboard access. Share it securely; employees can open
                the full portal after changing that password.
            </p>

            {error && (
                <p role="alert" style={{ color: "red" }}>
                    {error}
                </p>
            )}

            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Employee Status</th>
                        <th>Account</th>
                        <th>Action</th>
                    </tr>
                </thead>

                <tbody>
                    {employees.length === 0 ? (
                        <tr>
                            <td colSpan="6">No employees are available to create accounts for.</td>
                        </tr>
                    ) : employees.map((employee) => (
                        <tr key={employee.employee_id}>
                            <td>{employee.name}</td>
                            <td>{employee.email}</td>
                            <td>{employee.department}</td>
                            <td>{employee.employee_status}</td>

                            <td>
                                {employee.account_id
                                    ? employee.status === "active"
                                        ? "Active"
                                        : "Inactive"
                                    : "Not created"}
                            </td>

                            <td>
                                <button
                                    onClick={() => openGenerate(employee)}
                                    disabled={
                                        saving ||
                                        ["inactive", "terminated"].includes(employee.employee_status)
                                    }
                                >
                                    {["inactive", "terminated"].includes(employee.employee_status)
                                        ? "Unavailable"
                                        : employee.account_id
                                            ? "Reset Password"
                                            : "Generate Password"}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {selectedEmployee && (
                <div className="password-modal">

                    <h3>
                        {generatedPassword
                            ? "Password Generated"
                            : "Generate Employee Password"}
                    </h3>

                    <p>Employee: {selectedEmployee.name}</p>
                    <p>Email: {selectedEmployee.email}</p>

                    {!generatedPassword ? (
                        <>
                            <p>
                                Click below to generate a secure temporary
                                password for this employee.
                            </p>

                            <button
                                onClick={handleGenerate}
                                disabled={saving}
                            >
                                {saving
                                    ? "Generating..."
                                    : "Generate Password"}
                            </button>
                        </>
                    ) : (
                        <div>
                            <h3>Account Updated Successfully!</h3>

                            <p>Temporary password:</p>

                            <input
                                type="text"
                                value={generatedPassword}
                                readOnly
                            />

                            <button onClick={copyPassword}>
                                Copy Password
                            </button>

                            <p>
                                Share this password securely with the employee.
                                They should change it after their first login.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setSelectedEmployee(null);
                            setGeneratedPassword("");
                            setError("");
                        }}
                    >
                        Close
                    </button>

                </div>
            )}
        </div>
    );
}

export default EmployeeAccounts;
