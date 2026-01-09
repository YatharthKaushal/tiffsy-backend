import multer from "multer";

/**
 * Multer configuration for file uploads
 * Uses memory storage to store files in buffer before uploading to cloud storage
 */

const storage = multer.memoryStorage();

// File filter - accepts all file types
const fileFilter = (req, file, cb) => {
  console.log(`> File received: ${file.originalname} (${file.mimetype})`);
  cb(null, true);
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

/**
 * Middleware for single file upload
 * Field name: "file"
 */
export const uploadSingle = upload.single("file");

/**
 * Middleware for multiple file upload
 * Field name: "files"
 * Max files: 10
 */
export const uploadMultiple = upload.array("files", 10);

/**
 * Middleware for flexible upload (single or multiple)
 * Accepts both "file" (single) and "files" (multiple) fields
 */
export const uploadAny = upload.any();

export default upload;
