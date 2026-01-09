/**
 * Phone Number Utility
 * Normalizes phone numbers by extracting last 10 digits
 * Handles formats: +919179621765, 09179621765, 9179621765
 */

/**
 * Normalizes a phone number by extracting the last 10 digits
 * @param {string} phone - Phone number in any format
 * @returns {string|null} Normalized 10-digit phone number or null if invalid
 * @example
 * normalizePhone("+919179621765") // "9179621765"
 * normalizePhone("09179621765")   // "9179621765"
 * normalizePhone("9179621765")    // "9179621765"
 */
export const normalizePhone = (phone) => {
  if (!phone || typeof phone !== "string") {
    return null;
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, "");

  // Extract last 10 digits
  if (digitsOnly.length >= 10) {
    return digitsOnly.slice(-10);
  }

  // Return null if less than 10 digits
  return null;
};

/**
 * Validates if a string is a valid 10-digit Indian mobile number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid, false otherwise
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  // Check if it's exactly 10 digits and starts with 6-9 (Indian mobile)
  return /^[6-9]\d{9}$/.test(phone);
};

export default {
  normalizePhone,
  isValidPhone,
};
