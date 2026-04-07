const crypto = require("crypto");
const supabase = require("../config/supabase");
const { mapLead } = require("../utils/dbMappers");

const LEAD_SELECT = `
  id,
  owner_id,
  user_id,
  property_id,
  type,
  message,
  timestamp,
  created_at,
  updated_at,
  user:users!leads_user_id_fkey(id,name,email,phone,avatar,role),
  property:properties!leads_property_id_fkey(id,title,location,price,images,type)
`;

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

const findLeadByPropertyAndUser = async ({ propertyId, userId }) =>
  mapLead(
    await maybeSingle(
      supabase
        .from("leads")
        .select(LEAD_SELECT)
        .eq("property_id", propertyId)
        .eq("user_id", userId),
    ),
  );

const createLead = async (payload) =>
  mapLead(
    await single(
      supabase
        .from("leads")
        .insert({
          id: crypto.randomUUID(),
          owner_id: payload.ownerId || null,
          user_id: payload.userId,
          property_id: payload.propertyId,
          type: payload.type,
          message: payload.message || "",
          timestamp: payload.timestamp || new Date().toISOString(),
        })
        .select(LEAD_SELECT),
    ),
  );

const updateLead = async (id, changes) =>
  mapLead(
    await single(
      supabase
        .from("leads")
        .update({
          message: changes.message,
          timestamp: changes.timestamp,
        })
        .eq("id", id)
        .select(LEAD_SELECT),
    ),
  );

const listLeads = async ({ filter = {}, page = 1, limit = 10 }) => {
  let query = supabase.from("leads").select(LEAD_SELECT, { count: "exact" });

  if (filter.userId) query = query.eq("user_id", filter.userId);
  if (filter.ownerId) query = query.eq("owner_id", filter.ownerId);
  if (filter.propertyId) query = query.eq("property_id", filter.propertyId);
  if (filter.type) query = query.eq("type", filter.type);

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await query
    .order("timestamp", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data || []).map(mapLead),
    total: count || 0,
  };
};

module.exports = {
  createLead,
  findLeadByPropertyAndUser,
  listLeads,
  updateLead,
};
