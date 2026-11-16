import { useState } from "react";
import { addEmployee, updateEmployee } from "../services/employeeService";
import { uploadAdminProfilePhoto } from "../services/employeeDocumentService";
import { validateEmployee } from "../utils/employeeValidation.js";
import { EMPLOYEE_STATUSES } from "../utils/statusOptions.js";

const EMPTY_EMPLOYEE = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    country: "",
    role: "",
    department: "",
    employment_type: "",
    joining_date: "",
    manager_id: "",
    work_location: "",
    status: "active",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    emergency_contact_email: "",
    annual_leave_entitlement: "0"
};

const EMPLOYMENT_TYPES = [
    ["full_time", "Full Time"],
    ["part_time", "Part Time"],
    ["contract", "Contract"],
    ["intern", "Intern"],
    ["temporary", "Temporary"]
];

function EmployeeForm({ initialEmployee, managers, onCancel, onSaved }) {
    const [values, setValues] = useState(() => ({
        ...EMPTY_EMPLOYEE,
        ...initialEmployee,
        manager_id: initialEmployee?.manager_id || "",
        date_of_birth: initialEmployee?.date_of_birth?.slice(0, 10) || "",
        joining_date: initialEmployee?.joining_date?.slice(0, 10) || "",
        annual_leave_entitlement: String(initialEmployee?.annual_leave_entitlement ?? 0)
    }));
    const [photo, setPhoto] = useState(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    function update(field, value) {
        setValues(current => ({ ...current, [field]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        const name = [values.first_name.trim(), values.last_name.trim()]
            .filter(Boolean)
            .join(" ");
        const employee = { ...values, name, manager_id: values.manager_id || null };
        const validationError = validateEmployee(employee);
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setSaving(true);
            const result = initialEmployee
                ? await updateEmployee(initialEmployee.id, employee)
                : await addEmployee(employee);
            const employeeId = result.employee.id;
            if (photo) {
                try {
                    await uploadAdminProfilePhoto(employeeId, photo);
                } catch (photoError) {
                    setError(`Employee details were saved, but the profile photo was not: ${photoError.message}`);
                    return;
                }
            }
            await onSaved(employeeId);
        } catch (saveError) {
            setError(saveError.message || "Unable to save employee");
        } finally {
            setSaving(false);
        }
    }

    function field(name, label, options = {}) {
        const common = {
            id: `employee-${name}`,
            value: values[name] ?? "",
            required: options.required,
            onChange: event => update(name, event.target.value),
            maxLength: options.maxLength
        };
        return (
            <label key={name}>
                {label}
                {options.options ? (
                    <select {...common}>
                        <option value="">{options.placeholder || "Select"}</option>
                        {options.options.map(([value, title]) => (
                            <option key={value} value={value}>{title}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={options.type || "text"}
                        min={options.min}
                        max={options.max}
                        step={options.step}
                        {...common}
                    />
                )}
            </label>
        );
    }

    return (
        <form className="employee-record-form" onSubmit={handleSubmit}>
            {error && <p className="hr-alert error" role="alert">{error}</p>}

            <section className="employee-form-section">
                <h3>Personal Information</h3>
                <div className="employee-form-grid">
                    {field("first_name", "First name", { required: true, maxLength: 100 })}
                    {field("last_name", "Last name", { maxLength: 100 })}
                    {field("date_of_birth", "Date of birth", { type: "date" })}
                    {field("gender", "Gender", {
                        options: [
                            ["female", "Female"],
                            ["male", "Male"],
                            ["non_binary", "Non-binary"],
                            ["prefer_not_to_say", "Prefer not to say"],
                            ["self_described", "Self-described"]
                        ]
                    })}
                    {field("phone", "Phone", { type: "tel", maxLength: 30 })}
                    {field("email", "Email", { type: "email", required: true, maxLength: 150 })}
                    {field("address", "Address", { maxLength: 500 })}
                    {field("city", "City", { maxLength: 100 })}
                    {field("state", "State / Province", { maxLength: 100 })}
                    {field("country", "Country", { maxLength: 100 })}
                    <label className="employee-form-wide">
                        Profile photo
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={event => setPhoto(event.target.files?.[0] || null)}
                        />
                    </label>
                </div>
            </section>

            <section className="employee-form-section">
                <h3>Employment Information</h3>
                <div className="employee-form-grid">
                    {field("role", "Designation", { required: true, maxLength: 100 })}
                    {field("department", "Department", { required: true, maxLength: 100 })}
                    {field("employment_type", "Employment type", {
                        options: EMPLOYMENT_TYPES
                    })}
                    {field("joining_date", "Joining date", { type: "date" })}
                    {field("manager_id", "Reporting manager", {
                        options: managers
                            .filter(manager => manager.id !== initialEmployee?.id)
                            .map(manager => [
                                String(manager.id),
                                `${manager.name} (${manager.department})`
                            ]),
                        placeholder: "No reporting manager"
                    })}
                    {field("work_location", "Work location", { maxLength: 150 })}
                    {field("status", "Employment status", {
                        required: true,
                        options: EMPLOYEE_STATUSES.map(status => [
                            status.value,
                            status.label
                        ])
                    })}
                    {field("annual_leave_entitlement", "Annual leave entitlement (days)", {
                        type: "number",
                        min: 0,
                        max: 365,
                        step: 0.5
                    })}
                </div>
            </section>

            <section className="employee-form-section">
                <h3>Emergency Contact</h3>
                <div className="employee-form-grid">
                    {field("emergency_contact_name", "Contact name", { maxLength: 150 })}
                    {field("emergency_contact_relationship", "Relationship", { maxLength: 100 })}
                    {field("emergency_contact_phone", "Phone", { type: "tel", maxLength: 30 })}
                    {field("emergency_contact_email", "Email", { type: "email", maxLength: 150 })}
                </div>
            </section>

            <div className="employee-form-actions">
                <button type="submit" disabled={saving}>
                    {saving ? "Saving..." : initialEmployee ? "Save employee" : "Create employee"}
                </button>
                <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
                    Cancel
                </button>
            </div>
        </form>
    );
}

export default EmployeeForm;
