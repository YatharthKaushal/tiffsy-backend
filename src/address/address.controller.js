import CustomerAddress from "../../schema/customerAddress.schema.js";
import Zone from "../../schema/zone.schema.js";
import Kitchen from "../../schema/kitchen.schema.js";
import Order from "../../schema/order.schema.js";
import { sendResponse } from "../../utils/response.utils.js";

/**
 * Address Controller
 * Handles customer delivery address management
 */

/**
 * Helper: Check serviceability for a pincode
 * @param {string} pincode - 6-digit pincode
 * @returns {Object} Serviceability info
 */
const checkPincodeServiceability = async (pincode) => {
  const zone = await Zone.findOne({ pincode }).select(
    "_id name city status orderingEnabled"
  );

  if (!zone) {
    return { isServiceable: false, zoneId: null, zone: null };
  }

  const isServiceable = zone.status === "ACTIVE" && zone.orderingEnabled;
  return {
    isServiceable,
    zoneId: zone._id,
    zone: {
      _id: zone._id,
      name: zone.name,
      city: zone.city,
    },
  };
};

/**
 * Create a new delivery address
 *
 * POST /api/address
 */
export const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      label,
      addressLine1,
      addressLine2,
      landmark,
      locality,
      city,
      state,
      pincode,
      contactName,
      contactPhone,
      coordinates,
      isDefault,
    } = req.body;

    // Check serviceability
    const serviceability = await checkPincodeServiceability(pincode);

    // Check if this is the first address
    const existingCount = await CustomerAddress.countDocuments({
      userId,
      isDeleted: false,
    });

    // If setting as default or first address, unset other defaults
    const shouldBeDefault = isDefault || existingCount === 0;
    if (shouldBeDefault) {
      await CustomerAddress.updateMany(
        { userId, isDeleted: false },
        { $set: { isDefault: false } }
      );
    }

    const address = new CustomerAddress({
      userId,
      label: label.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2?.trim(),
      landmark: landmark?.trim(),
      locality: locality.trim(),
      city: city.trim(),
      state: state?.trim(),
      pincode,
      contactName: contactName?.trim(),
      contactPhone,
      coordinates,
      zoneId: serviceability.zoneId,
      isServiceable: serviceability.isServiceable,
      isDefault: shouldBeDefault,
    });

    await address.save();

    return sendResponse(res, 201, "Address created successfully", {
      address: address.toJSON(),
      isServiceable: serviceability.isServiceable,
      zone: serviceability.zone,
    });
  } catch (error) {
    console.log("> Create address error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all addresses for authenticated customer
 *
 * GET /api/address
 */
export const getAddresses = async (req, res) => {
  try {
    const userId = req.user._id;
    const { includeDeleted } = req.query;

    const filter = { userId };
    if (includeDeleted !== "true") {
      filter.isDeleted = false;
    }

    const addresses = await CustomerAddress.find(filter)
      .populate("zoneId", "name city status")
      .sort({ isDefault: -1, createdAt: -1 });

    const defaultAddress = addresses.find((a) => a.isDefault);

    return sendResponse(res, 200, "Addresses retrieved", {
      addresses,
      defaultAddressId: defaultAddress?._id || null,
    });
  } catch (error) {
    console.log("> Get addresses error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get address by ID
 *
 * GET /api/address/:id
 */
export const getAddressById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await CustomerAddress.findById(id).populate(
      "zoneId",
      "name city status orderingEnabled"
    );

    if (!address || address.isDeleted) {
      return sendResponse(res, 404, "Address not found");
    }

    // Ownership check
    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    // Count kitchens if serviceable
    let availableKitchens = 0;
    if (address.zoneId) {
      availableKitchens = await Kitchen.countDocuments({
        zonesServed: address.zoneId._id,
        status: "ACTIVE",
        isAcceptingOrders: true,
      });
    }

    return sendResponse(res, 200, "Address retrieved", {
      address,
      zone: address.zoneId,
      isServiceable: address.isServiceable,
      availableKitchens,
    });
  } catch (error) {
    console.log("> Get address by ID error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update address
 *
 * PUT /api/address/:id
 */
export const updateAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const updates = req.body;

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    // If pincode changed, re-check serviceability
    if (updates.pincode && updates.pincode !== address.pincode) {
      const serviceability = await checkPincodeServiceability(updates.pincode);
      address.zoneId = serviceability.zoneId;
      address.isServiceable = serviceability.isServiceable;
    }

    // If setting as default
    if (updates.isDefault === true) {
      await CustomerAddress.updateMany(
        { userId, _id: { $ne: id }, isDeleted: false },
        { $set: { isDefault: false } }
      );
    }

    // Update fields
    const allowedFields = [
      "label",
      "addressLine1",
      "addressLine2",
      "landmark",
      "locality",
      "city",
      "state",
      "pincode",
      "contactName",
      "contactPhone",
      "coordinates",
      "isDefault",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        address[field] = updates[field];
      }
    });

    await address.save();

    // Get updated zone info
    let zone = null;
    if (address.zoneId) {
      zone = await Zone.findById(address.zoneId).select("name city");
    }

    return sendResponse(res, 200, "Address updated successfully", {
      address: address.toJSON(),
      isServiceable: address.isServiceable,
      zone,
    });
  } catch (error) {
    console.log("> Update address error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete address (soft delete)
 *
 * DELETE /api/address/:id
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    // Check for pending orders using this address
    const pendingOrders = await Order.countDocuments({
      userId,
      "deliveryAddress.addressId": id,
      status: {
        $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"],
      },
    });

    if (pendingOrders > 0) {
      return sendResponse(
        res,
        400,
        "Cannot delete address with pending orders"
      );
    }

    const wasDefault = address.isDefault;

    // Soft delete
    address.isDeleted = true;
    address.isDefault = false;
    await address.save();

    // If was default, set another as default
    if (wasDefault) {
      const anotherAddress = await CustomerAddress.findOne({
        userId,
        isDeleted: false,
      }).sort({ createdAt: -1 });

      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      }
    }

    return sendResponse(res, 200, "Address deleted successfully");
  } catch (error) {
    console.log("> Delete address error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Set address as default
 *
 * PATCH /api/address/:id/default
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    // Unset all other defaults
    await CustomerAddress.updateMany(
      { userId, isDeleted: false },
      { $set: { isDefault: false } }
    );

    // Set this as default
    address.isDefault = true;
    await address.save();

    return sendResponse(res, 200, "Default address updated", {
      defaultAddressId: address._id,
    });
  } catch (error) {
    console.log("> Set default address error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Check serviceability for a pincode
 *
 * GET /api/address/check-serviceability
 */
export const checkServiceability = async (req, res) => {
  try {
    const { pincode } = req.query;

    // Validate pincode format
    if (!/^\d{6}$/.test(pincode)) {
      return sendResponse(res, 400, "Invalid pincode format");
    }

    const serviceability = await checkPincodeServiceability(pincode);

    let kitchenCount = 0;
    if (serviceability.zoneId) {
      kitchenCount = await Kitchen.countDocuments({
        zonesServed: serviceability.zoneId,
        status: "ACTIVE",
        isAcceptingOrders: true,
      });
    }

    return sendResponse(res, 200, "Serviceability checked", {
      pincode,
      isServiceable: serviceability.isServiceable,
      zone: serviceability.zone,
      kitchenCount,
      message: serviceability.isServiceable
        ? "We deliver to this area!"
        : "Sorry, we don't deliver to this area yet",
    });
  } catch (error) {
    console.log("> Check serviceability error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get kitchens that serve an address
 *
 * GET /api/address/:id/kitchens
 */
export const getServiceableKitchens = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const { menuType } = req.query;

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

    if (!address.isServiceable || !address.zoneId) {
      return sendResponse(res, 200, "Kitchens retrieved", {
        kitchens: [],
        count: 0,
        message: "This address is not serviceable",
      });
    }

    // Build filter
    const filter = {
      zonesServed: address.zoneId,
      status: "ACTIVE",
      isAcceptingOrders: true,
    };

    const kitchens = await Kitchen.find(filter)
      .select("name code type premiumFlag gourmetFlag logo cuisineTypes averageRating")
      .sort({ type: 1, averageRating: -1 });

    return sendResponse(res, 200, "Kitchens retrieved", {
      kitchens,
      count: kitchens.length,
    });
  } catch (error) {
    console.log("> Get serviceable kitchens error:", error);
    return sendResponse(res, 500, "Server error");
  }
};

export default {
  createAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  checkServiceability,
  getServiceableKitchens,
};
