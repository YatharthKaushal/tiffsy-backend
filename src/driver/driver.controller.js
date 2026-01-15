import User from "../../schema/user.schema.js";
import Order from "../../schema/order.schema.js";
import { sendResponse } from "../../utils/response.utils.js";
import { createLogger } from "../../utils/logger.utils.js";

// Create logger instance for this controller
const log = createLogger("DriverController");

/**
 * ============================================================================
 * DRIVER PROFILE MANAGEMENT
 * ============================================================================
 */

/**
 * Get driver profile with complete details
 * @route GET /api/driver/profile
 * @access Driver (authenticated)
 */
export async function getDriverProfile(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;

    log.request(req, "getDriverProfile");
    log.debug("getDriverProfile", "Fetching driver profile", {
      driverId: driverId.toString(),
    });

    const driver = await User.findOne({
      _id: driverId,
      role: "DRIVER",
      status: { $ne: "DELETED" },
    }).select("-passwordHash -fcmTokens");

    if (!driver) {
      log.warn("getDriverProfile", "Driver not found", {
        driverId: driverId.toString(),
      });
      return sendResponse(res, 404, false, "Driver profile not found");
    }

    // Get driver statistics
    const stats = await getDriverStats(driverId);

    const duration = Date.now() - startTime;
    log.response("getDriverProfile", 200, true, duration);

    return sendResponse(res, 200, true, "Driver profile retrieved", {
      profile: {
        _id: driver._id,
        phone: driver.phone,
        name: driver.name,
        email: driver.email,
        profileImage: driver.profileImage,
        status: driver.status,
        approvalStatus: driver.approvalStatus,
        driverDetails: driver.driverDetails,
        lastLoginAt: driver.lastLoginAt,
        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      },
      stats,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("getDriverProfile", "Failed to fetch driver profile", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to retrieve driver profile");
  }
}

/**
 * Update driver basic profile (name, email, profileImage)
 * @route PUT /api/driver/profile
 * @access Driver (authenticated)
 */
export async function updateDriverProfile(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;
    const { name, email, profileImage } = req.body;

    log.request(req, "updateDriverProfile");
    log.info("updateDriverProfile", "Updating driver profile", {
      driverId: driverId.toString(),
      fields: Object.keys(req.body),
    });

    const driver = await User.findOne({
      _id: driverId,
      role: "DRIVER",
      status: { $ne: "DELETED" },
    });

    if (!driver) {
      log.warn("updateDriverProfile", "Driver not found", {
        driverId: driverId.toString(),
      });
      return sendResponse(res, 404, false, "Driver profile not found");
    }

    // Update only provided fields
    const updatedFields = [];
    if (name !== undefined) {
      driver.name = name.trim();
      updatedFields.push("name");
    }
    if (email !== undefined) {
      driver.email = email?.trim() || undefined;
      updatedFields.push("email");
    }
    if (profileImage !== undefined) {
      driver.profileImage = profileImage || undefined;
      updatedFields.push("profileImage");
    }

    await driver.save();

    const duration = Date.now() - startTime;
    log.event("DRIVER_PROFILE_UPDATED", "Driver profile updated successfully", {
      driverId: driverId.toString(),
      updatedFields,
    });
    log.response("updateDriverProfile", 200, true, duration);

    return sendResponse(res, 200, true, "Profile updated successfully", {
      profile: {
        _id: driver._id,
        phone: driver.phone,
        name: driver.name,
        email: driver.email,
        profileImage: driver.profileImage,
        updatedAt: driver.updatedAt,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("updateDriverProfile", "Failed to update driver profile", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to update profile");
  }
}

/**
 * Update vehicle details (name, number, type)
 * @route PATCH /api/driver/vehicle
 * @access Driver (authenticated)
 */
export async function updateVehicleDetails(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;
    const { vehicleName, vehicleNumber, vehicleType } = req.body;

    log.request(req, "updateVehicleDetails");
    log.info("updateVehicleDetails", "Updating vehicle details", {
      driverId: driverId.toString(),
      fields: Object.keys(req.body),
    });

    const driver = await User.findOne({
      _id: driverId,
      role: "DRIVER",
      status: { $ne: "DELETED" },
    });

    if (!driver) {
      log.warn("updateVehicleDetails", "Driver not found", {
        driverId: driverId.toString(),
      });
      return sendResponse(res, 404, false, "Driver profile not found");
    }

    // Initialize driverDetails if not exists
    if (!driver.driverDetails) {
      driver.driverDetails = {};
    }

    // Update only provided vehicle fields
    const updatedFields = [];
    if (vehicleName !== undefined) {
      driver.driverDetails.vehicleName = vehicleName.trim();
      updatedFields.push("vehicleName");
    }
    if (vehicleNumber !== undefined) {
      driver.driverDetails.vehicleNumber = vehicleNumber.toUpperCase().trim();
      updatedFields.push("vehicleNumber");
    }
    if (vehicleType !== undefined) {
      driver.driverDetails.vehicleType = vehicleType;
      updatedFields.push("vehicleType");
    }

    // Mark the driverDetails as modified for Mongoose
    driver.markModified("driverDetails");
    await driver.save();

    const duration = Date.now() - startTime;
    log.event("VEHICLE_DETAILS_UPDATED", "Vehicle details updated successfully", {
      driverId: driverId.toString(),
      updatedFields,
    });
    log.response("updateVehicleDetails", 200, true, duration);

    return sendResponse(res, 200, true, "Vehicle details updated successfully", {
      vehicleDetails: {
        vehicleName: driver.driverDetails.vehicleName,
        vehicleNumber: driver.driverDetails.vehicleNumber,
        vehicleType: driver.driverDetails.vehicleType,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("updateVehicleDetails", "Failed to update vehicle details", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to update vehicle details");
  }
}

/**
 * Update profile image only
 * @route PATCH /api/driver/profile/image
 * @access Driver (authenticated)
 */
export async function updateDriverProfileImage(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;
    const { profileImage } = req.body;

    log.request(req, "updateDriverProfileImage");
    log.info("updateDriverProfileImage", "Updating profile image", {
      driverId: driverId.toString(),
    });

    const driver = await User.findOne({
      _id: driverId,
      role: "DRIVER",
      status: { $ne: "DELETED" },
    });

    if (!driver) {
      log.warn("updateDriverProfileImage", "Driver not found", {
        driverId: driverId.toString(),
      });
      return sendResponse(res, 404, false, "Driver profile not found");
    }

    driver.profileImage = profileImage;
    await driver.save();

    const duration = Date.now() - startTime;
    log.event("DRIVER_IMAGE_UPDATED", "Profile image updated successfully", {
      driverId: driverId.toString(),
    });
    log.response("updateDriverProfileImage", 200, true, duration);

    return sendResponse(res, 200, true, "Profile image updated successfully", {
      profileImage: driver.profileImage,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("updateDriverProfileImage", "Failed to update profile image", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to update profile image");
  }
}

/**
 * Request document update (requires admin approval)
 * Creates a request that admin must approve
 * @route POST /api/driver/documents/request
 * @access Driver (authenticated)
 */
export async function requestDocumentUpdate(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;
    const { documentType, reason, currentValue, requestedValue } = req.body;

    log.request(req, "requestDocumentUpdate");
    log.info("requestDocumentUpdate", "Document update requested", {
      driverId: driverId.toString(),
      documentType,
    });

    const driver = await User.findOne({
      _id: driverId,
      role: "DRIVER",
      status: { $ne: "DELETED" },
    });

    if (!driver) {
      log.warn("requestDocumentUpdate", "Driver not found", {
        driverId: driverId.toString(),
      });
      return sendResponse(res, 404, false, "Driver profile not found");
    }

    // TODO: In future, create a DocumentUpdateRequest collection to track these
    // For now, just log the request and return success
    // Admin will need to manually update these fields

    const duration = Date.now() - startTime;
    log.event("DOCUMENT_UPDATE_REQUESTED", "Document update request submitted", {
      driverId: driverId.toString(),
      documentType,
      reason,
      currentValue,
      requestedValue,
    });
    log.response("requestDocumentUpdate", 200, true, duration);

    return sendResponse(
      res,
      200,
      true,
      "Document update request submitted. Admin will review and update your documents.",
      {
        request: {
          driverId: driver._id,
          driverName: driver.name,
          documentType,
          reason,
          currentValue,
          requestedValue,
          requestedAt: new Date(),
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("requestDocumentUpdate", "Failed to submit document update request", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to submit document update request");
  }
}

/**
 * Get driver delivery statistics
 * @route GET /api/driver/stats
 * @access Driver (authenticated)
 */
export async function getDriverStatistics(req, res) {
  const startTime = Date.now();
  try {
    const driverId = req.user._id;

    log.request(req, "getDriverStatistics");
    log.debug("getDriverStatistics", "Fetching driver statistics", {
      driverId: driverId.toString(),
    });

    const stats = await getDriverStats(driverId);

    const duration = Date.now() - startTime;
    log.response("getDriverStatistics", 200, true, duration);

    return sendResponse(res, 200, true, "Driver statistics retrieved", {
      stats,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error("getDriverStatistics", "Failed to fetch driver statistics", {
      error,
      duration: `${duration}ms`,
    });
    return sendResponse(res, 500, false, "Failed to retrieve statistics");
  }
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Calculate driver statistics
 * @param {ObjectId} driverId - Driver's user ID
 * @returns {Promise<Object>} Statistics object
 */
async function getDriverStats(driverId) {
  try {
    const [totalDeliveries, deliveredCount, failedCount, activeCount] = await Promise.all([
      // Total deliveries assigned
      Order.countDocuments({ driverId }),

      // Successfully delivered
      Order.countDocuments({ driverId, status: "DELIVERED" }),

      // Failed deliveries
      Order.countDocuments({ driverId, status: "FAILED" }),

      // Currently active deliveries
      Order.countDocuments({
        driverId,
        status: { $in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
      }),
    ]);

    // Calculate success rate
    const successRate =
      totalDeliveries > 0 ? ((deliveredCount / totalDeliveries) * 100).toFixed(2) : 0;

    return {
      totalDeliveries,
      deliveredCount,
      failedCount,
      activeCount,
      successRate: parseFloat(successRate),
    };
  } catch (error) {
    log.error("getDriverStats", "Error calculating driver stats", { error });
    return {
      totalDeliveries: 0,
      deliveredCount: 0,
      failedCount: 0,
      activeCount: 0,
      successRate: 0,
    };
  }
}

export default {
  getDriverProfile,
  updateDriverProfile,
  updateVehicleDetails,
  updateDriverProfileImage,
  requestDocumentUpdate,
  getDriverStatistics,
};
