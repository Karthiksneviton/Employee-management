const express = require("express");
const controller = require("../controllers/hrController");
const { authenticateEmployee } = require("../middleware/employeeAuthMiddleware");
const { updateEmployeePreferences } = require("../controllers/employeePreferencesController");
const documents = require("../controllers/employeeDocumentsController");

const router = express.Router();

router.get("/leave-requests", authenticateEmployee, controller.getEmployeeLeaves);
router.post("/leave-requests", authenticateEmployee, controller.createEmployeeLeave);
router.get("/profile-change-requests", authenticateEmployee, controller.getEmployeeProfileChangeRequests);
router.post("/profile-change-requests", authenticateEmployee, controller.createEmployeeProfileChangeRequest);
router.patch("/preferences", authenticateEmployee, updateEmployeePreferences);
router.get("/documents", authenticateEmployee, documents.listEmployeeDocuments);
router.post("/documents", authenticateEmployee, documents.uploadDocument, documents.uploadEmployeeDocument);
router.get("/documents/:documentId/file", authenticateEmployee, documents.getEmployeeDocument);
router.post("/profile-photo", authenticateEmployee, documents.uploadPhoto, documents.uploadEmployeePhoto);
router.get("/profile-photo", authenticateEmployee, documents.getEmployeePhoto);
router.get("/announcements", authenticateEmployee, controller.getEmployeeAnnouncements);
router.get("/notifications", authenticateEmployee, controller.getNotifications);
router.patch("/notifications/read", authenticateEmployee, controller.markNotificationRead);

module.exports = router;
