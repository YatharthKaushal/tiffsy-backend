import Joi from "joi";

/**
 * Menu Validation Schemas
 */

const MENU_TYPES = ["MEAL_MENU", "ON_DEMAND_MENU"];
const MEAL_WINDOWS = ["LUNCH", "DINNER"];
const DIETARY_TYPES = ["VEG", "NON_VEG", "VEGAN", "EGGETARIAN"];
const SPICE_LEVELS = ["MILD", "MEDIUM", "SPICY", "EXTRA_SPICY"];
const CATEGORIES = ["MAIN_COURSE"];

/**
 * Create menu item
 */
export const createMenuItemSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24), // Required for admin, auto for staff
  name: Joi.string().min(2).max(100).trim().required().messages({
    "any.required": "Menu item name is required",
    "string.min": "Name must be at least 2 characters",
  }),
  description: Joi.string().max(500).trim().allow("", null),
  category: Joi.string()
    .valid(...CATEGORIES)
    .default("MAIN_COURSE"),
  menuType: Joi.string()
    .valid(...MENU_TYPES)
    .required()
    .messages({
      "any.required": "Menu type is required",
      "any.only": "Menu type must be MEAL_MENU or ON_DEMAND_MENU",
    }),
  mealWindow: Joi.string()
    .valid(...MEAL_WINDOWS)
    .when("menuType", {
      is: "MEAL_MENU",
      then: Joi.required().messages({
        "any.required": "Meal window is required for MEAL_MENU items",
      }),
      otherwise: Joi.forbidden(),
    }),
  price: Joi.number().min(0).required().messages({
    "any.required": "Price is required",
    "number.min": "Price cannot be negative",
  }),
  discountedPrice: Joi.number().min(0).less(Joi.ref("price")).allow(null),
  portionSize: Joi.string().max(50).trim().allow("", null),
  preparationTime: Joi.number().integer().min(0).max(180).allow(null),
  dietaryType: Joi.string()
    .valid(...DIETARY_TYPES)
    .allow(null),
  isJainFriendly: Joi.boolean().default(false),
  spiceLevel: Joi.string()
    .valid(...SPICE_LEVELS)
    .allow(null),
  images: Joi.array().items(Joi.string().uri()).max(5),
  thumbnailImage: Joi.string().uri().allow("", null),
  addonIds: Joi.array().items(Joi.string().hex().length(24)),
  includes: Joi.array().items(Joi.string().max(100).trim()).max(10),
  isAvailable: Joi.boolean().default(true),
  displayOrder: Joi.number().integer().min(0),
  isFeatured: Joi.boolean().default(false),
});

/**
 * Update menu item
 */
export const updateMenuItemSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  description: Joi.string().max(500).trim().allow("", null),
  price: Joi.number().min(0),
  discountedPrice: Joi.number().min(0).allow(null),
  portionSize: Joi.string().max(50).trim().allow("", null),
  preparationTime: Joi.number().integer().min(0).max(180).allow(null),
  dietaryType: Joi.string()
    .valid(...DIETARY_TYPES)
    .allow(null),
  isJainFriendly: Joi.boolean(),
  spiceLevel: Joi.string()
    .valid(...SPICE_LEVELS)
    .allow(null),
  images: Joi.array().items(Joi.string().uri()).max(5),
  thumbnailImage: Joi.string().uri().allow("", null),
  addonIds: Joi.array().items(Joi.string().hex().length(24)),
  includes: Joi.array().items(Joi.string().max(100).trim()).max(10),
  displayOrder: Joi.number().integer().min(0),
  isFeatured: Joi.boolean(),
});

/**
 * Toggle availability
 */
export const toggleAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required().messages({
    "any.required": "isAvailable is required",
  }),
});

/**
 * Update add-ons
 */
export const updateAddonsSchema = Joi.object({
  addonIds: Joi.array()
    .items(Joi.string().hex().length(24))
    .required()
    .messages({
      "any.required": "addonIds array is required",
    }),
});

/**
 * Disable menu item (admin)
 */
export const disableMenuItemSchema = Joi.object({
  reason: Joi.string().min(10).max(500).trim().required().messages({
    "any.required": "Reason is required to disable a menu item",
    "string.min": "Reason must be at least 10 characters",
  }),
});

/**
 * Query menu items
 */
export const queryMenuItemsSchema = Joi.object({
  kitchenId: Joi.string().hex().length(24),
  menuType: Joi.string().valid(...MENU_TYPES),
  mealWindow: Joi.string().valid(...MEAL_WINDOWS),
  category: Joi.string().valid(...CATEGORIES),
  dietaryType: Joi.string().valid(...DIETARY_TYPES),
  isAvailable: Joi.boolean(),
  status: Joi.string().valid("ACTIVE", "INACTIVE", "DISABLED_BY_ADMIN"),
  search: Joi.string().max(50).trim(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export default {
  createMenuItemSchema,
  updateMenuItemSchema,
  toggleAvailabilitySchema,
  updateAddonsSchema,
  disableMenuItemSchema,
  queryMenuItemsSchema,
};
