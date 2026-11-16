
const express = require("express");
const router = express.Router();
const { rateLimit } = require("express-rate-limit");

const {
    changeEmployeePassword,
    employeeLogin
} = require("../controllers/employeeAuthController");
const { authenticateEmployee } = require("../middleware/employeeAuthMiddleware");
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many login attempts. Try again in 15 minutes." }
});

router.post(
    "/login",
    loginRateLimit,
    employeeLogin
);

router.post(
    "/change-password",
    authenticateEmployee,
    changeEmployeePassword
);

module.exports = router;
