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
  console.log(`> Checking serviceability for pincode: ${pincode}`);

  const zone = await Zone.findOne({ pincode }).select(
    "_id name city status orderingEnabled"
  );

  if (!zone) {
    console.log(`> Pincode ${pincode}: Zone not found`);
    return { isServiceable: false, zoneId: null, zone: null };
  }

  const isServiceable = zone.status === "ACTIVE" && zone.orderingEnabled;
  console.log(`> Pincode ${pincode}: Zone found - ${zone.name}, serviceable: ${isServiceable}`);

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

    console.log(`> Create address request - userId: ${userId}, label: ${label}, pincode: ${pincode}`);

    // Check serviceability
    const serviceability = await checkPincodeServiceability(pincode);

    // Check if this is the first address
    const existingCount = await CustomerAddress.countDocuments({
      userId,
      isDeleted: false,
    });
    console.log(`> User ${userId} has ${existingCount} existing addresses`);

    // If setting as default or first address, unset other defaults
    const shouldBeDefault = isDefault || existingCount === 0;
    if (shouldBeDefault && existingCount > 0) {
      console.log(`> Unsetting default for other addresses`);
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

    console.log(`> Address created successfully - id: ${address._id}, serviceable: ${serviceability.isServiceable}`);

    return sendResponse(res, 201, "Address created successfully", {
      address: address.toJSON(),
      isServiceable: serviceability.isServiceable,
      zone: serviceability.zone,
    });
  } catch (error) {
    console.error("> Create address error:", error.message);
    console.error("> Create address stack:", error.stack);
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

    console.log(`> Get addresses request - userId: ${userId}, includeDeleted: ${includeDeleted}`);

    const filter = { userId };
    if (includeDeleted !== "true") {
      filter.isDeleted = false;
    }

    const addresses = await CustomerAddress.find(filter)
      .populate("zoneId", "name city status")
      .sort({ isDefault: -1, createdAt: -1 });

    const defaultAddress = addresses.find((a) => a.isDefault);

    console.log(`> Found ${addresses.length} addresses for user ${userId}`);

    return sendResponse(res, 200, "Addresses retrieved", {
      addresses,
      defaultAddressId: defaultAddress?._id || null,
    });
  } catch (error) {
    console.error("> Get addresses error:", error.message);
    console.error("> Get addresses stack:", error.stack);
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

    console.log(`> Get address by ID request - userId: ${userId}, addressId: ${id}`);

    const address = await CustomerAddress.findById(id).populate(
      "zoneId",
      "name city status orderingEnabled"
    );

    if (!address || address.isDeleted) {
      console.log(`> Address ${id} not found or deleted`);
      return sendResponse(res, 404, "Address not found");
    }

    // Ownership check
    if (address.userId.toString() !== userId.toString()) {
      console.log(`> Access denied - address belongs to different user`);
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

    console.log(`> Address ${id} retrieved - serviceable: ${address.isServiceable}, kitchens: ${availableKitchens}`);

    return sendResponse(res, 200, "Address retrieved", {
      address,
      zone: address.zoneId,
      isServiceable: address.isServiceable,
      availableKitchens,
    });
  } catch (error) {
    console.error("> Get address by ID error:", error.message);
    console.error("> Get address by ID stack:", error.stack);
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

    console.log(`> Update address request - userId: ${userId}, addressId: ${id}`);
    console.log(`> Update fields: ${Object.keys(updates).join(", ")}`);

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      console.log(`> Address ${id} not found or deleted`);
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      console.log(`> Access denied - address belongs to different user`);
      return sendResponse(res, 403, "Access denied");
    }

    // If pincode changed, re-check serviceability
    if (updates.pincode && updates.pincode !== address.pincode) {
      console.log(`> Pincode changed from ${address.pincode} to ${updates.pincode}`);
      const serviceability = await checkPincodeServiceability(updates.pincode);
      address.zoneId = serviceability.zoneId;
      address.isServiceable = serviceability.isServiceable;
    }

    // If setting as default
    if (updates.isDefault === true) {
      console.log(`> Setting address ${id} as default`);
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

    console.log(`> Address ${id} updated successfully`);

    return sendResponse(res, 200, "Address updated successfully", {
      address: address.toJSON(),
      isServiceable: address.isServiceable,
      zone,
    });
  } catch (error) {
    console.error("> Update address error:", error.message);
    console.error("> Update address stack:", error.stack);
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

    console.log(`> Delete address request - userId: ${userId}, addressId: ${id}`);

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      console.log(`> Address ${id} not found or already deleted`);
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      console.log(`> Access denied - address belongs to different user`);
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
      console.log(`> Cannot delete address ${id} - has ${pendingOrders} pending orders`);
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

    console.log(`> Address ${id} soft deleted, wasDefault: ${wasDefault}`);

    // If was default, set another as default
    if (wasDefault) {
      const anotherAddress = await CustomerAddress.findOne({
        userId,
        isDeleted: false,
      }).sort({ createdAt: -1 });

      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
        console.log(`> Set address ${anotherAddress._id} as new default`);
      }
    }

    return sendResponse(res, 200, "Address deleted successfully");
  } catch (error) {
    console.error("> Delete address error:", error.message);
    console.error("> Delete address stack:", error.stack);
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

    console.log(`> Set default address request - userId: ${userId}, addressId: ${id}`);

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      console.log(`> Address ${id} not found or deleted`);
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      console.log(`> Access denied - address belongs to different user`);
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

    console.log(`> Address ${id} set as default for user ${userId}`);

    return sendResponse(res, 200, "Default address updated", {
      defaultAddressId: address._id,
    });
  } catch (error) {
    console.error("> Set default address error:", error.message);
    console.error("> Set default address stack:", error.stack);
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

    console.log(`> Check serviceability request - pincode: ${pincode}`);

    // Validate pincode format
    if (!/^\d{6}$/.test(pincode)) {
      console.log(`> Invalid pincode format: ${pincode}`);
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
      console.log(`> Found ${kitchenCount} active kitchens for zone ${serviceability.zone?.name}`);
    }

    console.log(`> Serviceability check complete - pincode: ${pincode}, serviceable: ${serviceability.isServiceable}`);

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
    console.error("> Check serviceability error:", error.message);
    console.error("> Check serviceability stack:", error.stack);
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

    console.log(`> Get serviceable kitchens request - userId: ${userId}, addressId: ${id}, menuType: ${menuType || "all"}`);

    const address = await CustomerAddress.findById(id);

    if (!address || address.isDeleted) {
      console.log(`> Address ${id} not found or deleted`);
      return sendResponse(res, 404, "Address not found");
    }

    if (address.userId.toString() !== userId.toString()) {
      console.log(`> Access denied - address belongs to different user`);
      return sendResponse(res, 403, "Access denied");
    }

    if (!address.isServiceable || !address.zoneId) {
      console.log(`> Address ${id} is not serviceable`);
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

    console.log(`> Found ${kitchens.length} kitchens serving address ${id}`);

    return sendResponse(res, 200, "Kitchens retrieved", {
      kitchens,
      count: kitchens.length,
    });
  } catch (error) {
    console.error("> Get serviceable kitchens error:", error.message);
    console.error("> Get serviceable kitchens stack:", error.stack);
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
