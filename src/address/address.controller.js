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
    zone: { _id: zone._id, name: zone.name, city: zone.city },
  };
};

/**
 * Create a new delivery address
 * POST /api/address
 */
export const createAddress = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      label, addressLine1, addressLine2, landmark, locality,
      city, state, pincode, contactName, contactPhone, coordinates, isDefault,
    } = req.body;

    const serviceability = await checkPincodeServiceability(pincode);

    const existingCount = await CustomerAddress.countDocuments({
      userId,
      isDeleted: false,
    });

    const shouldBeDefault = isDefault || existingCount === 0;
    if (shouldBeDefault && existingCount > 0) {
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

    console.log(`> Address created: ${address._id}, serviceable: ${serviceability.isServiceable}`);

    return sendResponse(res, 201, "Address created successfully", {
      address: address.toJSON(),
      isServiceable: serviceability.isServiceable,
      zone: serviceability.zone,
    });
  } catch (error) {
    console.error(`> Create address error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all addresses for authenticated customer
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
    console.error(`> Get addresses error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get address by ID
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

    if (address.userId.toString() !== userId.toString()) {
      return sendResponse(res, 403, "Access denied");
    }

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
    console.error(`> Get address error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Update address
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

    if (updates.pincode && updates.pincode !== address.pincode) {
      const serviceability = await checkPincodeServiceability(updates.pincode);
      address.zoneId = serviceability.zoneId;
      address.isServiceable = serviceability.isServiceable;
    }

    if (updates.isDefault === true) {
      await CustomerAddress.updateMany(
        { userId, _id: { $ne: id }, isDeleted: false },
        { $set: { isDefault: false } }
      );
    }

    const allowedFields = [
      "label", "addressLine1", "addressLine2", "landmark", "locality",
      "city", "state", "pincode", "contactName", "contactPhone", "coordinates", "isDefault",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        address[field] = updates[field];
      }
    });

    await address.save();

    let zone = null;
    if (address.zoneId) {
      zone = await Zone.findById(address.zoneId).select("name city");
    }

    console.log(`> Address updated: ${id}`);

    return sendResponse(res, 200, "Address updated successfully", {
      address: address.toJSON(),
      isServiceable: address.isServiceable,
      zone,
    });
  } catch (error) {
    console.error(`> Update address error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Delete address (soft delete)
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

    const pendingOrders = await Order.countDocuments({
      userId,
      "deliveryAddress.addressId": id,
      status: {
        $in: ["PLACED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"],
      },
    });

    if (pendingOrders > 0) {
      return sendResponse(res, 400, "Cannot delete address with pending orders");
    }

    const wasDefault = address.isDefault;

    address.isDeleted = true;
    address.isDefault = false;
    await address.save();

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

    console.log(`> Address deleted: ${id}`);

    return sendResponse(res, 200, "Address deleted successfully");
  } catch (error) {
    console.error(`> Delete address error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Set address as default
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

    await CustomerAddress.updateMany(
      { userId, isDeleted: false },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();

    console.log(`> Default address set: ${id}`);

    return sendResponse(res, 200, "Default address updated", {
      defaultAddressId: address._id,
    });
  } catch (error) {
    console.error(`> Set default error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Check serviceability for a pincode
 * GET /api/address/check-serviceability
 */
export const checkServiceability = async (req, res) => {
  try {
    const { pincode } = req.query;

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
    console.error(`> Check serviceability error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get kitchens that serve an address
 * GET /api/address/:id/kitchens
 */
export const getServiceableKitchens = async (req, res) => {
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

    if (!address.isServiceable || !address.zoneId) {
      return sendResponse(res, 200, "Kitchens retrieved", {
        kitchens: [],
        count: 0,
        message: "This address is not serviceable",
      });
    }

    const filter = {
      zonesServed: address.zoneId,
      status: "ACTIVE",
      isAcceptingOrders: true,
    };

    const kitchens = await Kitchen.find(filter)
      .select("name code type premiumFlag gourmetFlag logo cuisineTypes averageRating operatingHours")
      .sort({ type: 1, averageRating: -1 });

    console.log(`> Kitchens for address ${id}: ${kitchens.length}`);

    return sendResponse(res, 200, "Kitchens retrieved", {
      kitchens,
      count: kitchens.length,
    });
  } catch (error) {
    console.error(`> Get kitchens error: ${error.message}`);
    return sendResponse(res, 500, "Server error");
  }
};

/**
 * Get all customer addresses (Admin only)
 * GET /api/address/admin/all
 */
export const getAllCustomerAddresses = async (req, res) => {
  try {
    const { page = 1, limit = 20, includeDeleted = false, userId, zoneId, city } = req.query;

    // Build filter
    const filter = {};
    if (includeDeleted !== "true") {
      filter.isDeleted = false;
    }
    if (userId) {
      filter.userId = userId;
    }
    if (zoneId) {
      filter.zoneId = zoneId;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Query addresses with user info
    const [addresses, total] = await Promise.all([
      CustomerAddress.find(filter)
        .populate("userId", "name phone email")
        .populate("zoneId", "name city pincode status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CustomerAddress.countDocuments(filter),
    ]);

    // Filter by city if provided (after population)
    let filteredAddresses = addresses;
    if (city) {
      filteredAddresses = addresses.filter(
        (addr) => addr.zoneId?.city?.toLowerCase() === city.toLowerCase()
      );
    }

    return sendResponse(res, 200, "All customer addresses retrieved", {
      addresses: filteredAddresses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(`> Get all customer addresses error: ${error.message}`);
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
  getAllCustomerAddresses,
};
