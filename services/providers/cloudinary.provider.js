import cloudinary from "../../config/cloudinary.config.js";

/**
 * Cloudinary storage provider
 * Implements the storage interface for Cloudinary
 */

/**
 * Upload a single file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {object} options - Upload options
 * @param {string} options.folder - Folder path in Cloudinary
 * @param {string} options.resourceType - Resource type (image, video, raw, auto)
 * @returns {Promise<object>} Upload result with url, publicId, etc.
 */
export const uploadFile = async (fileBuffer, options = {}) => {
  const { folder = "uploads", resourceType = "auto" } = options;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          console.log("> Cloudinary upload error:", error.message);
          reject(error);
          return;
        }

        console.log("> Cloudinary upload success:", result.public_id);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          resourceType: result.resource_type,
          bytes: result.bytes,
          width: result.width || null,
          height: result.height || null,
          createdAt: result.created_at,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload multiple files to Cloudinary
 * @param {Array<Buffer>} fileBuffers - Array of file buffers
 * @param {object} options - Upload options
 * @returns {Promise<Array<object>>} Array of upload results
 */
export const uploadFiles = async (fileBuffers, options = {}) => {
  console.log(`> Uploading ${fileBuffers.length} files to Cloudinary`);
  const results = await Promise.all(
    fileBuffers.map((buffer) => uploadFile(buffer, options))
  );
  return results;
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} Deletion result
 */
export const deleteFile = async (publicId, resourceType = "image") => {
  console.log("> Deleting from Cloudinary:", publicId);
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
  console.log("> Cloudinary delete result:", result.result);
  return result;
};

/**
 * Delete multiple files from Cloudinary
 * @param {Array<string>} publicIds - Array of public IDs
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} Deletion result
 */
export const deleteFiles = async (publicIds, resourceType = "image") => {
  console.log(`> Deleting ${publicIds.length} files from Cloudinary`);
  const result = await cloudinary.api.delete_resources(publicIds, {
    resource_type: resourceType,
  });
  return result;
};

export default {
  uploadFile,
  uploadFiles,
  deleteFile,
  deleteFiles,
  providerName: "cloudinary",
};
