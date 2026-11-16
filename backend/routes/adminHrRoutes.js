const express = require("express");
const controller = require("../controllers/hrController");
const { authenticateAdmin, authorizeRoles } = require("../middleware/adminAuthMiddleware");
const documents = require("../controllers/employeeDocumentsController");

const router = express.Router();

router.use(authenticateAdmin, authorizeRoles("admin"));
router.get("/notifications", controller.getNotifications);
router.get("/employees/:employeeId/documents", documents.listAdminDocuments);
router.post("/employees/:employeeId/documents", documents.uploadDocument, documents.uploadAdminDocument);
router.get("/employees/:employeeId/documents/:documentId/file", documents.getAdminDocument);
router.delete("/employees/:employeeId/documents/:documentId", documents.deleteAdminDocument);
router.post("/employees/:employeeId/profile-photo", documents.uploadPhoto, documents.uploadAdminPhoto);
router.get("/employees/:employeeId/profile-photo", documents.getAdminPhoto);
router.patch("/notifications/read", controller.markNotificationRead);
router.get("/leave-requests", controller.getAdminLeaves);
router.patch("/leave-requests/:id", controller.reviewLeave);
router.get("/profile-change-requests", controller.getAdminProfileChangeRequests);
router.patch("/profile-change-requests/:id", controller.reviewAdminProfileChangeRequest);
router.get("/audit-logs", controller.getAdminAuditLogs);
router.get("/announcements", controller.getAdminAnnouncements);
router.post("/announcements", controller.publishAnnouncement);
router.patch("/announcements/:id/archive", controller.archiveAnnouncement);
router.get("/attendance", controller.getAdminAttendance);
router.put("/attendance", controller.saveAttendance);
router.patch("/attendance/:id", controller.correctAttendance);

module.exports = router;
