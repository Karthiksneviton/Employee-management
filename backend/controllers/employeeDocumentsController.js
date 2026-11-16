const fs = require("node:fs/promises");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const multer = require("multer");
const { writeAuditLog } = require("./hrController");

const storageRoot = path.resolve(
    process.env.HR_STORAGE_PATH || path.join(__dirname, "..", "private_uploads")
);
mkdirSync(storageRoot, { recursive: true, mode: 0o700 });

const DOCUMENT_TYPES = new Set([
    "offer_letter",
    "joining_letter",
    "employment_contract",
    "id_proof",
    "address_proof",
    "certificate",
    "experience_letter",
    "payslip",
    "other"
]);
const MIME_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png"
};
const documentMimeTypes = new Set(Object.keys(MIME_EXTENSIONS));
const photoMimeTypes = new Set(["image/jpeg", "image/png"]);

function createUpload({ maxBytes, mimeTypes }) {
    return multer({
        storage: multer.diskStorage({
            destination: storageRoot,
            filename: (_req, _file, callback) => {
                callback(null, `${crypto.randomUUID()}.upload`);
            }
        }),
        limits: { fileSize: maxBytes, files: 1, fields: 2, fieldSize: 1024 },
        fileFilter: (_req, file, callback) => {
            if (!mimeTypes.has(file.mimetype)) {
                return callback(new Error("Unsupported file type"));
            }
            return callback(null, true);
        }
    }).single("file");
}

const uploadDocument = createUpload({
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: documentMimeTypes
});
const uploadPhoto = createUpload({
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: photoMimeTypes
});

function uploadMiddleware(upload) {
    return (req, res, next) => upload(req, res, error => {
        if (error) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "The selected file is too large"
                : error.message;
            return res.status(400).json({ message });
        }
        return next();
    });
}

function isValidCalendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function hasValidSignature(filePath, mimeType) {
    const file = await fs.open(filePath, "r");
    try {
        const signature = Buffer.alloc(8);
        const { bytesRead } = await file.read(signature, 0, signature.length, 0);
        const bytes = signature.subarray(0, bytesRead);
        if (mimeType === "application/pdf") {
            return bytes.length >= 5 && bytes.subarray(0, 5).toString() === "%PDF-";
        }
        if (mimeType === "image/png") {
            return bytes.length >= 8 &&
                bytes.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        }
        if (mimeType === "image/jpeg") {
            return bytes.length >= 3 &&
                bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        }
        return false;
    } finally {
        await file.close();
    }
}

function safeOriginalName(value) {
    return String(value)
        .split(/[\\/]/)
        .pop()
        .replace(/[\r\n"]/g, "_")
        .slice(0, 255) || "document";
}

function documentId(req) {
    const id = Number(req.params.documentId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function employeeId(req) {
    const id = Number(req.params.employeeId);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function setFileHeaders(res, document, preview) {
    const filename = safeOriginalName(document.original_name);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
        "Content-Disposition",
        `${preview ? "inline" : "attachment"}; filename="${filename}"`
    );
    res.type(document.mime_type);
}

function sendPrivateFile(res, next, filePath, context, missingMessage, failureMessage) {
    return res.sendFile(filePath, error => {
        if (!error) return;
        if (res.headersSent) return next(error);

        const missing = error.code === "ENOENT";
        console.error(`${context}:`, error);
        return res.status(missing ? 404 : 500).json({
            message: missing ? missingMessage : failureMessage
        });
    });
}

async function listDocuments(req, res, isEmployee) {
    const id = isEmployee ? req.employee.id : employeeId(req);
    if (!id) return res.status(400).json({ message: "Invalid employee ID" });
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT id, employee_id, document_type, original_name,
                    mime_type, size_bytes, expires_at, uploaded_by_type,
                    created_at
             FROM employee_documents
             WHERE employee_id = $1
             ORDER BY created_at DESC, id DESC`,
            [id]
        );
        return res.json({ documents: rows });
    } catch (error) {
        console.error("List employee documents error:", error);
        return res.status(500).json({ message: "Unable to load employee documents" });
    }
}

async function uploadEmployeeDocument(req, res, isEmployee) {
    const id = isEmployee ? req.employee.id : employeeId(req);
    if (!id) {
        if (req.file) await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Invalid employee ID" });
    }
    if (!req.file) return res.status(400).json({ message: "Select a document to upload" });

    const { documentType, expiresAt = "" } = req.body || {};
    if (!DOCUMENT_TYPES.has(documentType) ||
        (expiresAt && !isValidCalendarDate(expiresAt))) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Provide a valid document type and expiry date" });
    }
    if (!await hasValidSignature(req.file.path, req.file.mimetype)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ message: "The uploaded file does not match its file type" });
    }

    const storageName = `${path.parse(req.file.filename).name}${MIME_EXTENSIONS[req.file.mimetype]}`;
    const storedPath = path.join(storageRoot, storageName);
    let client;
    let transactionOpen = false;
    try {
        await fs.rename(req.file.path, storedPath);
        await fs.chmod(storedPath, 0o600);
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const { rows } = await client.query(
            `INSERT INTO employee_documents
                (employee_id, document_type, original_name, storage_name,
                 mime_type, size_bytes, expires_at, uploaded_by_type, uploaded_by_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, employee_id, document_type, original_name,
                       mime_type, size_bytes, expires_at, uploaded_by_type, created_at`,
            [
                id,
                documentType,
                safeOriginalName(req.file.originalname),
                storageName,
                req.file.mimetype,
                req.file.size,
                expiresAt || null,
                isEmployee ? "employee" : "admin",
                isEmployee ? req.employee.id : req.admin.id
            ]
        );
        await writeAuditLog(client, {
            actorType: isEmployee ? "employee" : "admin",
            actorId: isEmployee ? req.employee.id : req.admin.id,
            action: "employee.document.uploaded",
            entityType: "employee_document",
            entityId: rows[0].id,
            details: { employeeId: id, documentType }
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return res.status(201).json({ document: rows[0] });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        for (const filePath of [storedPath, req.file.path]) {
            await fs.unlink(filePath).catch(cleanupError => {
                if (cleanupError.code !== "ENOENT") {
                    console.error("Uploaded document cleanup error:", cleanupError);
                }
            });
        }
        console.error("Upload employee document error:", error);
        return res.status(500).json({ message: "Unable to save employee document" });
    } finally {
        if (client) client.release();
    }
}

async function getDocument(req, res, next, isEmployee) {
    const id = documentId(req);
    const targetEmployeeId = isEmployee ? req.employee.id : employeeId(req);
    if (!id || !targetEmployeeId) {
        return res.status(400).json({ message: "Invalid document or employee ID" });
    }
    try {
        const { rows } = await req.app.locals.pool.query(
            `SELECT storage_name, original_name, mime_type
             FROM employee_documents
             WHERE id = $1 AND employee_id = $2`,
            [id, targetEmployeeId]
        );
        const document = rows[0];
        if (!document) return res.status(404).json({ message: "Document not found" });
        setFileHeaders(res, document, req.query.preview === "1");
        return sendPrivateFile(
            res,
            next,
            path.join(storageRoot, path.basename(document.storage_name)),
            "Get employee document error",
            "Stored document file is unavailable",
            "Unable to retrieve employee document"
        );
    } catch (error) {
        console.error("Get employee document error:", error);
        return res.status(500).json({ message: "Unable to retrieve employee document" });
    }
}

async function deleteDocument(req, res) {
    const id = documentId(req);
    const targetEmployeeId = employeeId(req);
    if (!id || !targetEmployeeId) {
        return res.status(400).json({ message: "Invalid document or employee ID" });
    }

    let client;
    let transactionOpen = false;
    let removedPath;
    try {
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const result = await client.query(
            `DELETE FROM employee_documents
             WHERE id = $1 AND employee_id = $2
             RETURNING storage_name`,
            [id, targetEmployeeId]
        );
        if (!result.rows.length) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return res.status(404).json({ message: "Document not found" });
        }
        removedPath = path.join(storageRoot, path.basename(result.rows[0].storage_name));
        await writeAuditLog(client, {
            actorType: "admin",
            actorId: req.admin.id,
            action: "employee.document.deleted",
            entityType: "employee_document",
            entityId: id,
            details: { employeeId: targetEmployeeId }
        });
        await client.query("COMMIT");
        transactionOpen = false;
        await fs.unlink(removedPath).catch(error => {
            if (error.code !== "ENOENT") {
                console.error("Deleted document file cleanup error:", error);
            }
        });
        return res.json({ deleted: true });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        console.error("Delete employee document error:", error);
        return res.status(500).json({ message: "Unable to delete employee document" });
    } finally {
        if (client) client.release();
    }
}

async function uploadProfilePhoto(req, res, isEmployee) {
    const id = isEmployee ? req.employee.id : employeeId(req);
    if (!id) {
        if (req.file) await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Invalid employee ID" });
    }
    if (!req.file) return res.status(400).json({ message: "Select a profile photo" });
    if (!photoMimeTypes.has(req.file.mimetype) ||
        !await hasValidSignature(req.file.path, req.file.mimetype)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ message: "Upload a valid JPEG or PNG profile photo" });
    }

    const extension = MIME_EXTENSIONS[req.file.mimetype];
    const storageName = `${path.parse(req.file.filename).name}${extension}`;
    const storedPath = path.join(storageRoot, storageName);
    let replacedPhotoPath;
    let oldPath;
    let client;
    let transactionOpen = false;
    try {
        await fs.rename(req.file.path, storedPath);
        await fs.chmod(storedPath, 0o600);
        client = await req.app.locals.pool.connect();
        await client.query("BEGIN");
        transactionOpen = true;
        const result = await client.query(
            `UPDATE employees
             SET profile_photo_path = $1
             WHERE id = $2
             RETURNING id, profile_photo_path`,
            [storageName, id]
        );
        if (!result.rows.length) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            await fs.unlink(storedPath);
            return res.status(404).json({ message: "Employee not found" });
        }
        replacedPhotoPath = result.rows[0].profile_photo_path;
        await writeAuditLog(client, {
            actorType: isEmployee ? "employee" : "admin",
            actorId: isEmployee ? req.employee.id : req.admin.id,
            action: "employee.profile_photo.updated",
            entityType: "employee",
            entityId: id
        });
        await client.query("COMMIT");
        transactionOpen = false;
        oldPath = replacedPhotoPath;
        return res.json({ uploaded: true });
    } catch (error) {
        if (transactionOpen && client) await client.query("ROLLBACK");
        for (const filePath of [storedPath, req.file.path]) {
            await fs.unlink(filePath).catch(cleanupError => {
                if (cleanupError.code !== "ENOENT") {
                    console.error("Uploaded profile photo cleanup error:", cleanupError);
                }
            });
        }
        console.error("Upload employee photo error:", error);
        return res.status(500).json({ message: "Unable to update profile photo" });
    } finally {
        if (client) client.release();
        if (oldPath && oldPath !== storageName) {
            await fs.unlink(path.join(storageRoot, path.basename(oldPath))).catch(error => {
                if (error.code !== "ENOENT") console.error("Old profile photo cleanup error:", error);
            });
        }
    }
}

async function getProfilePhoto(req, res, next, isEmployee) {
    const id = isEmployee ? req.employee.id : employeeId(req);
    if (!id) return res.status(400).json({ message: "Invalid employee ID" });
    try {
        const { rows } = await req.app.locals.pool.query(
            "SELECT profile_photo_path FROM employees WHERE id = $1",
            [id]
        );
        const photo = rows[0]?.profile_photo_path;
        if (!photo) return res.status(404).json({ message: "Profile photo not found" });
        const filePath = path.join(storageRoot, path.basename(photo));
        const extension = path.extname(photo);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.type(extension === ".png" ? "image/png" : "image/jpeg");
        return sendPrivateFile(
            res,
            next,
            filePath,
            "Get employee photo error",
            "Stored profile photo is unavailable",
            "Unable to retrieve profile photo"
        );
    } catch (error) {
        console.error("Get employee photo error:", error);
        return res.status(500).json({ message: "Unable to retrieve profile photo" });
    }
}

module.exports = {
    uploadDocument: uploadMiddleware(uploadDocument),
    uploadPhoto: uploadMiddleware(uploadPhoto),
    listAdminDocuments: (req, res) => listDocuments(req, res, false),
    listEmployeeDocuments: (req, res) => listDocuments(req, res, true),
    uploadAdminDocument: (req, res) => uploadEmployeeDocument(req, res, false),
    uploadEmployeeDocument: (req, res) => uploadEmployeeDocument(req, res, true),
    getAdminDocument: (req, res, next) => getDocument(req, res, next, false),
    getEmployeeDocument: (req, res, next) => getDocument(req, res, next, true),
    deleteAdminDocument: deleteDocument,
    uploadAdminPhoto: (req, res) => uploadProfilePhoto(req, res, false),
    uploadEmployeePhoto: (req, res) => uploadProfilePhoto(req, res, true),
    getAdminPhoto: (req, res, next) => getProfilePhoto(req, res, next, false),
    getEmployeePhoto: (req, res, next) => getProfilePhoto(req, res, next, true)
};
