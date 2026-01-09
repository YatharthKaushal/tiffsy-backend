/**
 * Storage Service - Abstract storage layer
 *
 * To switch storage providers (e.g., from Cloudinary to S3):
 * 1. Create a new provider in services/providers/ (e.g., s3.provider.js)
 * 2. Import and use it here instead of cloudinary.provider.js
 * 3. Ensure the new provider exports the same interface:
 *    - uploadFile(buffer, options) -> { url, publicId, ... }
 *    - uploadFiles(buffers, options) -> [{ url, publicId, ... }]
 *    - deleteFile(publicId, resourceType)
 *    - deleteFiles(publicIds, resourceType)
 */

import cloudinaryProvider from "./providers/cloudinary.provider.js";

// Current active provider - change this to switch storage
const activeProvider = cloudinaryProvider;

console.log(`> Storage service initialized with provider: ${activeProvider.providerName}`);

/**
 * Upload a single file
 * @param {Buffer} fileBuffer - File buffer
 * @param {object} options - Upload options (folder, resourceType)
 * @returns {Promise<object>} Upload result
 */
export const uploadFile = async (fileBuffer, options = {}) => {
  return activeProvider.uploadFile(fileBuffer, options);
};

/**
 * Upload multiple files
 * @param {Array<Buffer>} fileBuffers - Array of file buffers
 * @param {object} options - Upload options
 * @returns {Promise<Array<object>>} Array of upload results
 */
export const uploadFiles = async (fileBuffers, options = {}) => {
  return activeProvider.uploadFiles(fileBuffers, options);
};

/**
 * Delete a file
 * @param {string} publicId - File public ID
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} Deletion result
 */
export const deleteFile = async (publicId, resourceType) => {
  return activeProvider.deleteFile(publicId, resourceType);
};

/**
 * Delete multiple files
 * @param {Array<string>} publicIds - Array of public IDs
 * @param {string} resourceType - Resource type
 * @returns {Promise<object>} Deletion result
 */
export const deleteFiles = async (publicIds, resourceType) => {
  return activeProvider.deleteFiles(publicIds, resourceType);
};

export default {
  uploadFile,
  uploadFiles,
  deleteFile,
  deleteFiles,
  providerName: activeProvider.providerName,
};
