
const Attendance = require("../models/attendanceModel");

// GET TODAY'S ATTENDANCE
exports.getTodayAttendance = async (req, res) => {

    try {

        const employeeId = req.employee.id;

        const attendance =
            await Attendance.getTodayAttendance(req.app.locals.pool, employeeId);

        return res.status(200).json({
            success: true,
            attendance
        });

    } catch (error) {

        console.error("Today attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch attendance"
        });
    }
};


// CHECK IN
exports.checkIn = async (req, res) => {

    try {

        const employeeId = req.employee.id;

        const attendance =
            await Attendance.checkIn(req.app.locals.pool, employeeId);

        if (!attendance) {

            return res.status(409).json({
                success: false,
                message: "You have already checked in today or an attendance record already exists."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Checked in successfully!",
            attendance
        });

    } catch (error) {

        console.error("Check-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check in"
        });
    }
};


// CHECK OUT
exports.checkOut = async (req, res) => {

    try {

        const employeeId = req.employee.id;

        const attendance =
            await Attendance.checkOut(req.app.locals.pool, employeeId);

        if (!attendance) {

            return res.status(409).json({
                success: false,
                message: "No active check-in found. You may have already checked out."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Checked out successfully!",
            attendance
        });

    } catch (error) {

        console.error("Check-out error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to check out"
        });
    }
};


// GET ATTENDANCE HISTORY
exports.getAttendanceHistory = async (req, res) => {

    try {

        const employeeId = req.employee.id;

        const pageValue = Number(req.query.page);
        const page = Number.isSafeInteger(pageValue) && pageValue > 0
            ? Math.min(pageValue, 1000000)
            : 1;

        const limit = Math.min(
            31,
            Math.max(1, parseInt(req.query.limit, 10) || 10)
        );

        const offset = (page - 1) * limit;

        const attendance =
            await Attendance.getAttendanceHistory(
                req.app.locals.pool,
                employeeId,
                limit,
                offset
            );

        const total =
            await Attendance.getAttendanceCount(req.app.locals.pool, employeeId);

        return res.status(200).json({

            success: true,

            attendance,

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }

        });

    } catch (error) {

        console.error("Attendance history error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch attendance history"
        });
    }
};
