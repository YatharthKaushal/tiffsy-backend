import { Router } from "express";
import { uploadMedia, deleteMedia } from "./cloudinary.controller.js";
import { uploadAny } from "../../middlewares/upload.middleware.js";

const router = Router();

/**
 * @route POST /api/upload
 * @description Upload single or multiple media files
 * @access Public
 *
 * @usage
 * This endpoint accepts multipart/form-data with files.
 * Use field name "file" for single upload or "files" for multiple.
 *
 * Query Parameters:
 * - folder (optional): Custom folder path (default: "uploads")
 *
 * @example cURL (single file)
 * curl -X POST "http://localhost:5005/api/upload?folder=avatars" \
 *   -F "file=@/path/to/image.jpg"
 *
 * @example cURL (multiple files)
 * curl -X POST "http://localhost:5005/api/upload?folder=gallery" \
 *   -F "files=@/path/to/image1.jpg" \
 *   -F "files=@/path/to/image2.png"
 *
 * @example JavaScript (fetch)
 * const formData = new FormData();
 * formData.append('file', fileInput.files[0]);
 * const response = await fetch('/api/upload?folder=avatars', {
 *   method: 'POST',
 *   body: formData
 * });
 * const { data } = await response.json();
 * console.log(data.files[0].url); // Use this URL in subsequent requests
 *
 * @requestBody multipart/form-data
 * - file: Single file (any type - image, video, pdf, etc.)
 * - files: Multiple files (max 10, any type)
 *
 * @responseBody Success (200)
 * {
 *   "message": "Upload successful",
 *   "data": {
 *     "files": [{
 *       "url": "https://res.cloudinary.com/.../image.jpg",
 *       "publicId": "uploads/abc123",
 *       "format": "jpg",
 *       "resourceType": "image",
 *       "bytes": 12345,
 *       "width": 800,
 *       "height": 600,
 *       "createdAt": "2024-01-01T00:00:00Z"
 *     }],
 *     "count": 1
 *   },
 *   "error": null
 * }
 *
 * @responseBody Error (400) - No files
 * { "message": "No files provided", "data": null, "error": "..." }
 *
 * @responseBody Error (500) - Upload failed
 * { "message": "Upload failed", "data": null, "error": "..." }
 */
router.post("/", uploadAny, uploadMedia);

/**
 * @route DELETE /api/upload
 * @description Delete media file(s) from cloud storage
 * @access Public
 *
 * @example cURL (single delete)
 * curl -X DELETE "http://localhost:5005/api/upload" \
 *   -H "Content-Type: application/json" \
 *   -d '{"publicId": "uploads/abc123"}'
 *
 * @example cURL (multiple delete)
 * curl -X DELETE "http://localhost:5005/api/upload" \
 *   -H "Content-Type: application/json" \
 *   -d '{"publicIds": ["uploads/abc", "uploads/def"], "resourceType": "image"}'
 *
 * @requestBody application/json
 * {
 *   "publicId": "uploads/abc123",
 *   "publicIds": ["uploads/a", "uploads/b"],
 *   "resourceType": "image" // optional: image, video, raw
 * }
 *
 * @responseBody Success (200)
 * { "message": "Delete successful", "data": { "deleted": [...] }, "error": null }
 *
 * @responseBody Error (400)
 * { "message": "Invalid request", "data": null, "error": "..." }
 */
router.delete("/", deleteMedia);

export default router;
