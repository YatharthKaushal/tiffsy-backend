/**
 * Pagination Utility
 * Standardized pagination helpers for MongoDB queries
 */

/**
 * Parse pagination parameters from query
 * @param {object} query - Express req.query object
 * @param {object} options - Default options
 * @param {number} options.defaultPage - Default page number (default: 1)
 * @param {number} options.defaultLimit - Default items per page (default: 20)
 * @param {number} options.maxLimit - Maximum allowed limit (default: 100)
 * @returns {object} Parsed pagination params { page, limit, skip }
 */
export function parsePagination(query, options = {}) {
  const {
    defaultPage = 1,
    defaultLimit = 20,
    maxLimit = 100,
  } = options;

  let page = parseInt(query.page) || defaultPage;
  let limit = parseInt(query.limit) || defaultLimit;

  // Ensure page is at least 1
  page = Math.max(1, page);

  // Ensure limit is within bounds
  limit = Math.max(1, Math.min(limit, maxLimit));

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Build pagination response object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total count of items
 * @returns {object} Pagination response object
 */
export function buildPaginationResponse(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

/**
 * Apply pagination to a Mongoose query
 * @param {object} mongooseQuery - Mongoose query object
 * @param {object} paginationParams - Pagination params from parsePagination
 * @returns {object} Modified query with skip and limit applied
 */
export function applyPagination(mongooseQuery, paginationParams) {
  const { skip, limit } = paginationParams;
  return mongooseQuery.skip(skip).limit(limit);
}

/**
 * Execute paginated query with total count
 * @param {object} Model - Mongoose model
 * @param {object} queryFilter - MongoDB query filter
 * @param {object} paginationParams - Pagination params from parsePagination
 * @param {object} options - Query options
 * @param {string} options.select - Fields to select
 * @param {object} options.populate - Populate config
 * @param {object} options.sort - Sort config (default: { createdAt: -1 })
 * @returns {Promise<object>} { data, pagination }
 */
export async function executePaginatedQuery(
  Model,
  queryFilter,
  paginationParams,
  options = {}
) {
  const { page, limit, skip } = paginationParams;
  const { select, populate, sort = { createdAt: -1 } } = options;

  let query = Model.find(queryFilter);

  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);
  if (sort) query = query.sort(sort);

  const [data, total] = await Promise.all([
    query.skip(skip).limit(limit),
    Model.countDocuments(queryFilter),
  ]);

  return {
    data,
    pagination: buildPaginationResponse(page, limit, total),
  };
}

export default {
  parsePagination,
  buildPaginationResponse,
  applyPagination,
  executePaginatedQuery,
};
