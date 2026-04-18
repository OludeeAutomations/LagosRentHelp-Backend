const crypto = require("crypto");
const supabase = require("../config/supabase");
const { mapProperty } = require("../utils/dbMappers");

const PROPERTY_SELECT = `
  id,
  title,
  description,
  price,
  location,
  total_package_price,
  type,
  listing_type,
  bedrooms,
  bathrooms,
  area,
  amenities,
  images,
  owner_id,
  contact_user_id,
  created_by,
  status,
  approval_status,
  approved_by,
  approved_at,
  approval_note,
  views,
  likes,
  rating,
  review_count,
  available_from,
  minimum_stay,
  created_at,
  updated_at,
  owner:users!properties_owner_id_fkey(id,name,email,phone,avatar,role),
  contact_user:users!properties_contact_user_id_fkey(id,name,email,phone,avatar,role),
  creator:users!properties_created_by_fkey(id,name,email,phone,avatar,role),
  approver:users!properties_approved_by_fkey(id,name,email,phone,avatar,role)
`;

const buildId = () => crypto.randomUUID();

const maybeSingle = async (query) => {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

const single = async (query) => {
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
};

const createProperty = async (payload) =>
  mapProperty(
    await single(
      supabase
        .from("properties")
        .insert({
          id: payload.id || buildId(),
          title: payload.title,
          description: payload.description,
          price: payload.price,
          location: payload.location,
          total_package_price: payload.totalPackagePrice ?? null,
          type: payload.type,
          listing_type: payload.listingType,
          bedrooms: payload.bedrooms,
          bathrooms: payload.bathrooms,
          area: payload.area,
          amenities: payload.amenities || [],
          images: payload.images || [],
          owner_id: payload.ownerId,
          contact_user_id: payload.contactUserId,
          created_by: payload.createdBy,
          status: payload.status || "available",
          approval_status: payload.approvalStatus || "pending",
          approved_by: payload.approvedBy || null,
          approved_at: payload.approvedAt || null,
          approval_note: payload.approvalNote || null,
          views: payload.views ?? 0,
          likes: payload.likes ?? 0,
          rating: payload.rating ?? 0,
          review_count: payload.reviewCount ?? 0,
          available_from: payload.availableFrom || null,
          minimum_stay: payload.minimumStay || null,
        })
        .select(PROPERTY_SELECT),
    ),
  );

const findPropertyById = async (id) =>
  mapProperty(
    await maybeSingle(
      supabase.from("properties").select(PROPERTY_SELECT).eq("id", id),
    ),
  );

const listProperties = async ({
  filters = {},
  page = 1,
  limit = 10,
  sort = { column: "created_at", ascending: false },
}) => {
  let query = supabase
    .from("properties")
    .select(PROPERTY_SELECT, { count: "exact" });

  if (filters.publicApprovalOnly) {
    query = query.or("approval_status.eq.approved,approval_status.is.null");
  }

  if (filters.status) {
    if (Array.isArray(filters.status))
      query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.location)
    query = query.ilike("location", `%${filters.location}%`);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.minPrice !== undefined)
    query = query.gte("price", filters.minPrice);
  if (filters.maxPrice !== undefined)
    query = query.lte("price", filters.maxPrice);
  if (filters.bedrooms !== undefined)
    query = query.eq("bedrooms", filters.bedrooms);
  if (filters.amenities?.length)
    query = query.contains("amenities", filters.amenities);
  if (filters.approvalStatus)
    query = query.eq("approval_status", filters.approvalStatus);
  if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
  if (filters.contactUserId)
    query = query.eq("contact_user_id", filters.contactUserId);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);
  if (filters.orManagedByUserId) {
    const userId = filters.orManagedByUserId;
    query = query.or(
      `created_by.eq.${userId},contact_user_id.eq.${userId},owner_id.eq.${userId}`,
    );
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data || []).map(mapProperty),
    total: count || 0,
  };
};

const updateProperty = async (id, changes) => {
  const payload = {};

  if ("title" in changes) payload.title = changes.title;
  if ("description" in changes) payload.description = changes.description;
  if ("price" in changes) payload.price = changes.price;
  if ("location" in changes) payload.location = changes.location;
  if ("totalPackagePrice" in changes) {
    payload.total_package_price = changes.totalPackagePrice;
  }
  if ("type" in changes) payload.type = changes.type;
  if ("listingType" in changes) payload.listing_type = changes.listingType;
  if ("bedrooms" in changes) payload.bedrooms = changes.bedrooms;
  if ("bathrooms" in changes) payload.bathrooms = changes.bathrooms;
  if ("area" in changes) payload.area = changes.area;
  if ("amenities" in changes) payload.amenities = changes.amenities;
  if ("images" in changes) payload.images = changes.images;
  if ("ownerId" in changes) payload.owner_id = changes.ownerId;
  if ("contactUserId" in changes)
    payload.contact_user_id = changes.contactUserId;
  if ("createdBy" in changes) payload.created_by = changes.createdBy;
  if ("status" in changes) payload.status = changes.status;
  if ("approvalStatus" in changes)
    payload.approval_status = changes.approvalStatus;
  if ("approvedBy" in changes) payload.approved_by = changes.approvedBy;
  if ("approvedAt" in changes) payload.approved_at = changes.approvedAt;
  if ("approvalNote" in changes) payload.approval_note = changes.approvalNote;
  if ("views" in changes) payload.views = changes.views;
  if ("likes" in changes) payload.likes = changes.likes;
  if ("rating" in changes) payload.rating = changes.rating;
  if ("reviewCount" in changes) payload.review_count = changes.reviewCount;
  if ("availableFrom" in changes)
    payload.available_from = changes.availableFrom;
  if ("minimumStay" in changes) payload.minimum_stay = changes.minimumStay;

  return mapProperty(
    await single(
      supabase
        .from("properties")
        .update(payload)
        .eq("id", id)
        .select(PROPERTY_SELECT),
    ),
  );
};

const incrementPropertyViews = async (id, nextViews) => {
  const { error } = await supabase
    .from("properties")
    .update({ views: nextViews })
    .eq("id", id);

  if (error) throw error;
};

const deleteProperty = async (id) => {
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw error;
};

module.exports = {
  createProperty,
  deleteProperty,
  findPropertyById,
  incrementPropertyViews,
  listProperties,
  updateProperty,
};
