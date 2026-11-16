
const express = require("express");

const router = express.Router();

const attendanceController =
    require("../controllers/attendanceController");

// Replace this import with your EXISTING employee JWT middleware.
const {
    authenticateEmployee
} = require("../middleware/employeeAuthMiddleware");

// Today's attendance
router.get(
    "/today",
    authenticateEmployee,
    attendanceController.getTodayAttendance
);

// Check in
router.post(
    "/check-in",
    authenticateEmployee,
    attendanceController.checkIn
);

// Check out
router.post(
    "/check-out",
    authenticateEmployee,
    attendanceController.checkOut
);

// Attendance history
router.get(
    "/",
    authenticateEmployee,
    attendanceController.getAttendanceHistory
);

module.exports = router;
