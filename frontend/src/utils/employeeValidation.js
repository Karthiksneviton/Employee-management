
import { EMPLOYEE_STATUSES } from "./statusOptions.js";

export function validateEmployee(employee) {
  const { name, email, role, department, status = "active" } = employee;

  if (!name || !email || !role || !department) {
    return "Please fill in all employee fields.";
  }

  if (name.length > 100) {
    return "Employee name cannot exceed 100 characters.";
  }

  if (email.length > 150) {
    return "Email cannot exceed 150 characters.";
  }

  if (role.length > 100) {
    return "Job role cannot exceed 100 characters.";
  }

  if (department.length > 100) {
    return "Department cannot exceed 100 characters.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return "Please enter a valid email address.";
  }

  if (!EMPLOYEE_STATUSES.some(option => option.value === status)) {
    return "Please select a valid employee status.";
  }

  return null;
}
