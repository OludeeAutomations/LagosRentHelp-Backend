const crypto = require("crypto");
const supabase = require("../config/supabase");
const { mapUser } = require("../utils/dbMappers");

const USER_SELECT = `
  id,
  name,
  email,
  phone,
  avatar,
  role,
  google_id,
  token_version,
  favorites,
  search_history,
  email_verified,
  phone_verified,
  last_login,
  password,
  restricted,
  verification,
  created_at,
  updated_at
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

const findById = async (id) =>
  mapUser(
    await maybeSingle(supabase.from("users").select(USER_SELECT).eq("id", id)),
  );

const findByEmail = async (email) =>
  mapUser(
    await maybeSingle(
      supabase.from("users").select(USER_SELECT).eq("email", email.toLowerCase()),
    ),
  );

const findByEmailOrPhone = async ({ email, phone }) => {
  const filters = [];
  if (email) filters.push(`email.eq.${email.toLowerCase()}`);
  if (phone) filters.push(`phone.eq.${phone}`);
  if (!filters.length) return null;

  return mapUser(
    await maybeSingle(
      supabase.from("users").select(USER_SELECT).or(filters.join(",")),
    ),
  );
};

const createUser = async (payload) => {
  const row = await single(
    supabase
      .from("users")
      .insert({
        id: payload.id || buildId(),
        name: payload.name,
        email: payload.email.toLowerCase(),
        phone: payload.phone || null,
        avatar: payload.avatar || null,
        role: payload.role || "user",
        google_id: payload.googleId || null,
        token_version: payload.tokenVersion ?? 0,
        favorites: payload.favorites || [],
        search_history: payload.searchHistory || [],
        email_verified: payload.emailVerified ?? false,
        phone_verified: payload.phoneVerified ?? false,
        last_login: payload.lastLogin || null,
        password: payload.password || null,
        restricted: payload.restricted ?? false,
        verification: payload.verification || {},
      })
      .select(USER_SELECT),
  );

  return mapUser(row);
};

const updateUser = async (id, changes) => {
  const payload = {};

  if ("name" in changes) payload.name = changes.name;
  if ("email" in changes && changes.email) payload.email = changes.email.toLowerCase();
  if ("phone" in changes) payload.phone = changes.phone;
  if ("avatar" in changes) payload.avatar = changes.avatar;
  if ("role" in changes) payload.role = changes.role;
  if ("googleId" in changes) payload.google_id = changes.googleId;
  if ("tokenVersion" in changes) payload.token_version = changes.tokenVersion;
  if ("favorites" in changes) payload.favorites = changes.favorites;
  if ("searchHistory" in changes) payload.search_history = changes.searchHistory;
  if ("emailVerified" in changes) payload.email_verified = changes.emailVerified;
  if ("phoneVerified" in changes) payload.phone_verified = changes.phoneVerified;
  if ("lastLogin" in changes) payload.last_login = changes.lastLogin;
  if ("password" in changes) payload.password = changes.password;
  if ("restricted" in changes) payload.restricted = changes.restricted;
  if ("verification" in changes) payload.verification = changes.verification;

  const row = await single(
    supabase.from("users").update(payload).eq("id", id).select(USER_SELECT),
  );

  return mapUser(row);
};

const listUsers = async ({ role, search, adminOnly = false }) => {
  let query = supabase.from("users").select(USER_SELECT).order("created_at", {
    ascending: false,
  });

  if (adminOnly) {
    if (role && ["admin", "super_admin"].includes(role)) {
      query = query.eq("role", role);
    } else {
      query = query.in("role", ["admin", "super_admin"]);
    }
  } else if (role) {
    query = query.eq("role", role);
  }

  if (search) {
    const term = search.replace(/,/g, "");
    query = query.or(
      `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapUser);
};

const deleteUser = async (id) => {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
};

const countPropertiesLinkedToUser = async (id) => {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .or(`contact_user_id.eq.${id},created_by.eq.${id}`);

  if (error) throw error;
  return count || 0;
};

const updateUsersByRole = async (fromRole, toRole) => {
  const { data, error } = await supabase
    .from("users")
    .update({ role: toRole })
    .eq("role", fromRole)
    .select("id");

  if (error) throw error;
  return {
    modifiedCount: data?.length || 0,
    ids: data?.map((row) => row.id) || [],
  };
};

module.exports = {
  countPropertiesLinkedToUser,
  createUser,
  deleteUser,
  findByEmail,
  findByEmailOrPhone,
  findById,
  listUsers,
  updateUser,
  updateUsersByRole,
};
