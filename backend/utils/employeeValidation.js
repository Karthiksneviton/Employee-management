const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+()\d.\-\s]{7,30}$/;
const EMPLOYEE_STATUSES = new Set(["active", "on_leave", "inactive", "terminated"]);
const EMPLOYMENT_TYPES = new Set(["full_time", "part_time", "contract", "intern", "temporary"]);
const GENDERS = new Set(["male", "female", "non_binary", "prefer_not_to_say", "self_described"]);

function isCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalText(value, field, maxLength, errors) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (typeof value !== "string" || value.trim().length > maxLength) {
        errors.push(`${field} must be a string of at most ${maxLength} characters`);
        return null;
    }
    return value.trim() || null;
}

function validateEmployee(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return ["Employee data must be an object"];
    }

    const errors = [];
    const legacyName = typeof data.name === "string" ? data.name.trim() : "";
    const nameParts = legacyName.split(/\s+/).filter(Boolean);
    const firstName = optionalText(
        data.first_name ?? nameParts[0] ?? "",
        "First name",
        100,
        errors
    );
    const lastName = optionalText(
        data.last_name ?? nameParts.slice(1).join(" "),
        "Last name",
        100,
        errors
    );
    const name = [firstName, lastName].filter(Boolean).join(" ") || legacyName;

    if (!firstName) errors.push("First name is required");
    if (!name) errors.push("Name is required");
    if (name.length > 100) errors.push("Name cannot exceed 100 characters");

    const email = optionalText(data.email, "Email", 150, errors);
    if (!email || !EMAIL_REGEX.test(email)) {
        errors.push("Please enter a valid email address");
    }

    const role = optionalText(data.role, "Designation", 100, errors);
    const department = optionalText(data.department, "Department", 100, errors);
    if (!role) errors.push("Designation is required");
    if (!department) errors.push("Department is required");

    const status = data.status === undefined ? "active" : data.status;
    if (typeof status !== "string" || !EMPLOYEE_STATUSES.has(status)) {
        errors.push("Please select a valid employee status");
    }

    const employmentType = optionalText(data.employment_type, "Employment type", 30, errors);
    if (employmentType && !EMPLOYMENT_TYPES.has(employmentType)) {
        errors.push("Please select a valid employment type");
    }

    const gender = optionalText(data.gender, "Gender", 30, errors);
    if (gender && !GENDERS.has(gender)) {
        errors.push("Please select a valid gender");
    }

    const dateOfBirth = optionalText(data.date_of_birth, "Date of birth", 10, errors);
    const joiningDate = optionalText(data.joining_date, "Joining date", 10, errors);
    if (dateOfBirth && !isCalendarDate(dateOfBirth)) {
        errors.push("Date of birth must be a valid calendar date");
    }
    if (joiningDate && !isCalendarDate(joiningDate)) {
        errors.push("Joining date must be a valid calendar date");
    }

    const phone = optionalText(data.phone, "Phone", 30, errors);
    const emergencyPhone = optionalText(data.emergency_contact_phone, "Emergency contact phone", 30, errors);
    for (const [label, value] of [["Phone", phone], ["Emergency contact phone", emergencyPhone]]) {
        if (value && !PHONE_REGEX.test(value)) {
            errors.push(`${label} must contain a valid phone number`);
        }
    }

    const emergencyEmail = optionalText(data.emergency_contact_email, "Emergency contact email", 150, errors);
    if (emergencyEmail && !EMAIL_REGEX.test(emergencyEmail)) {
        errors.push("Please enter a valid emergency contact email address");
    }

    const managerValue = data.manager_id === "" ||
        data.manager_id === undefined ||
        data.manager_id === null
        ? null
        : Number(data.manager_id);
    if (managerValue !== null &&
        (!Number.isSafeInteger(managerValue) || managerValue <= 0 || managerValue === Number(data.id))) {
        errors.push("Please select a valid reporting manager");
    }

    const entitlement = data.annual_leave_entitlement === undefined ||
        data.annual_leave_entitlement === ""
        ? 0
        : Number(data.annual_leave_entitlement);
    if (!Number.isFinite(entitlement) || entitlement < 0 || entitlement > 365) {
        errors.push("Annual leave entitlement must be between 0 and 365 days");
    }

    const employee = {
        name,
        first_name: firstName,
        last_name: lastName,
        email: email ? email.toLowerCase() : null,
        role,
        department,
        status,
        phone,
        date_of_birth: dateOfBirth,
        gender,
        address: optionalText(data.address, "Address", 500, errors),
        city: optionalText(data.city, "City", 100, errors),
        state: optionalText(data.state, "State", 100, errors),
        country: optionalText(data.country, "Country", 100, errors),
        employment_type: employmentType,
        joining_date: joiningDate,
        manager_id: managerValue,
        work_location: optionalText(data.work_location, "Work location", 150, errors),
        emergency_contact_name: optionalText(data.emergency_contact_name, "Emergency contact name", 150, errors),
        emergency_contact_relationship: optionalText(data.emergency_contact_relationship, "Emergency contact relationship", 100, errors),
        emergency_contact_phone: emergencyPhone,
        emergency_contact_email: emergencyEmail,
        annual_leave_entitlement: entitlement
    };

    return errors.length ? errors : { employee };
}

module.exports = validateEmployee;
