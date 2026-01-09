import storageService from "../../services/storage.service.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * @route POST /api/upload
 * @description Upload single or multiple media files to cloud storage
 * @access Public (add auth middleware as needed)
 *
 * @usage
 * - Use multipart/form-data
 * - For single file: use field name "file"
 * - For multiple files: use field name "files"
 * - Optional query param: ?folder=custom-folder (default: "uploads")
 *
 * @requestBody multipart/form-data
 * - file: Single file (any type)
 * - files: Multiple files (any type, max 10)
 *
 * @example Request (single file)
 * POST /api/upload?folder=avatars
 * Content-Type: multipart/form-data
 * Body: file=<binary>
 *
 * @example Request (multiple files)
 * POST /api/upload?folder=gallery
 * Content-Type: multipart/form-data
 * Body: files=<binary>, files=<binary>
 *
 * @responseBody Success (200)
 * {
 *   "message": "Upload successful",
 *   "data": {
 *     "files": [
 *       {
 *         "url": "https://res.cloudinary.com/.../image.jpg",
 *         "publicId": "uploads/abc123",
 *         "format": "jpg",
 *         "resourceType": "image",
 *         "bytes": 12345,
 *         "width": 800,
 *         "height": 600,
 *         "createdAt": "2024-01-01T00:00:00Z"
 *       }
 *     ],
 *     "count": 1
 *   },
 *   "error": null
 * }
 *
 * @responseBody Error (400)
 * {
 *   "message": "No files provided",
 *   "data": null,
 *   "error": "Please upload at least one file"
 * }
 *
 * @responseBody Error (500)
 * {
 *   "message": "Upload failed",
 *   "data": null,
 *   "error": "Error message details"
 * }
 */
export const uploadMedia = async (req, res) => {
  console.log("> Upload request received");
  console.log("> Request query:", req.query);

  try {
    // Get files from request (handles both single and multiple)
    const files = req.files || (req.file ? [req.file] : []);

    console.log(`> Files count: ${files.length}`);

    // Validate files exist
    if (!files || files.length === 0) {
      console.log("> No files provided");
      return sendResponse(
        res,
        400,
        "No files provided",
        null,
        "Please upload at least one file using field name 'file' or 'files'"
      );
    }

    // Get folder from query params
    const folder = req.query.folder || "uploads";
    console.log(`> Upload folder: ${folder}`);

    // Upload files to storage
    const uploadPromises = files.map((file) => {
      console.log(`> Processing: ${file.originalname}`);
      return storageService.uploadFile(file.buffer, { folder });
    });

    const results = await Promise.all(uploadPromises);
    console.log(`> Upload complete: ${results.length} files`);

    const responseData = {
      files: results,
      count: results.length,
    };

    console.log("> Response:", JSON.stringify(responseData, null, 2));
    return sendResponse(res, 200, "Upload successful", responseData, null);
  } catch (error) {
    console.log("> Upload error:", error.message);
    return sendResponse(res, 500, "Upload failed", null, error.message);
  }
};

/**
 * @route DELETE /api/upload
 * @description Delete media file(s) from cloud storage
 * @access Public (add auth middleware as needed)
 *
 * @requestBody application/json
 * {
 *   "publicId": "uploads/abc123",        // For single delete
 *   "publicIds": ["uploads/a", "uploads/b"], // For multiple delete
 *   "resourceType": "image"              // Optional: image, video, raw (default: image)
 * }
 *
 * @example Request (single delete)
 * DELETE /api/upload
 * Content-Type: application/json
 * Body: { "publicId": "uploads/abc123" }
 *
 * @example Request (multiple delete)
 * DELETE /api/upload
 * Content-Type: application/json
 * Body: { "publicIds": ["uploads/abc123", "uploads/def456"], "resourceType": "image" }
 *
 * @responseBody Success (200)
 * {
 *   "message": "Delete successful",
 *   "data": { "deleted": ["uploads/abc123"] },
 *   "error": null
 * }
 *
 * @responseBody Error (400)
 * {
 *   "message": "Invalid request",
 *   "data": null,
 *   "error": "Please provide publicId or publicIds"
 * }
 */
export const deleteMedia = async (req, res) => {
  console.log("> Delete request received");
  console.log("> Request body:", req.body);

  try {
    const { publicId, publicIds, resourceType = "image" } = req.body;

    // Validate input
    if (!publicId && (!publicIds || publicIds.length === 0)) {
      console.log("> No publicId(s) provided");
      return sendResponse(
        res,
        400,
        "Invalid request",
        null,
        "Please provide publicId or publicIds"
      );
    }

    let result;
    let deleted = [];

    if (publicIds && publicIds.length > 0) {
      // Multiple delete
      console.log(`> Deleting ${publicIds.length} files`);
      result = await storageService.deleteFiles(publicIds, resourceType);
      deleted = publicIds;
    } else {
      // Single delete
      console.log(`> Deleting: ${publicId}`);
      result = await storageService.deleteFile(publicId, resourceType);
      deleted = [publicId];
    }

    console.log("> Delete complete");
    return sendResponse(res, 200, "Delete successful", { deleted, result }, null);
  } catch (error) {
    console.log("> Delete error:", error.message);
    return sendResponse(res, 500, "Delete failed", null, error.message);
  }
};
