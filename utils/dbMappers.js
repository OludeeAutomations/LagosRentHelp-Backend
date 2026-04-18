const { getDisplayAvatar } = require("../services/userAvatarService");

const normalizeIdFields = (record) => {
  if (!record || typeof record !== "object") return record;

  const normalized = { ...record };

  if (normalized.id && !normalized._id) {
    normalized._id = normalized.id;
  }

  return normalized;
};

const mapUser = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    displayAvatar: getDisplayAvatar(row),
    role: row.role,
    googleId: row.google_id,
    tokenVersion: row.token_version ?? 0,
    favorites: row.favorites || [],
    searchHistory: row.search_history || [],
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    lastLogin: row.last_login,
    password: row.password,
    restricted: Boolean(row.restricted),
    verification: row.verification || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const mapRelatedUser = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    avatar: row.avatar,
    displayAvatar: getDisplayAvatar(row),
    role: row.role,
  });
};

const mapProperty = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    location: row.location,
    totalPackagePrice: row.total_package_price,
    type: row.type,
    listingType: row.listing_type,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    area: row.area,
    amenities: row.amenities || [],
    images: row.images || [],
    ownerId: row.owner ? mapRelatedUser(row.owner) : row.owner_id,
    contactUserId: row.contact_user
      ? mapRelatedUser(row.contact_user)
      : row.contact_user_id,
    createdBy: row.creator ? mapRelatedUser(row.creator) : row.created_by,
    status: row.status,
    approvalStatus: row.approval_status,
    approvedBy: row.approver ? mapRelatedUser(row.approver) : row.approved_by,
    approvedAt: row.approved_at,
    approvalNote: row.approval_note,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    rating: row.rating ?? 0,
    reviewCount: row.review_count ?? 0,
    availableFrom: row.available_from,
    minimumStay: row.minimum_stay,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const mapLead = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    ownerId: row.owner_id,
    userId: row.user ? mapRelatedUser(row.user) : row.user_id,
    propertyId: row.property ? mapProperty(row.property) : row.property_id,
    type: row.type,
    message: row.message,
    timestamp: row.timestamp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const mapNotification = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    link: row.link,
    priority: row.priority,
    actionRequired: Boolean(row.action_required),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

const mapReview = (row) => {
  if (!row) return null;

  return normalizeIdFields({
    id: row.id,
    propertyId: row.property_id,
    userId: row.user ? mapRelatedUser(row.user) : row.user_id,
    rating: row.rating,
    comment: row.comment,
    isVerified: Boolean(row.is_verified),
    response: row.response,
    responseDate: row.response_date,
    helpful: row.helpful ?? 0,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

module.exports = {
  mapLead,
  mapNotification,
  mapProperty,
  mapReview,
  mapUser,
};
