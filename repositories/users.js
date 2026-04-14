const crypto = require("crypto");
const supabase = require("../config/supabase");
const {
  applyAvatarPolicyToCreate,
  applyAvatarPolicyToUpdate,
} = require("../services/userAvatarService");
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
  const nextPayload = applyAvatarPolicyToCreate(payload);
  const row = await single(
    supabase
      .from("users")
      .insert({
        id: nextPayload.id || buildId(),
        name: nextPayload.name,
        email: nextPayload.email.toLowerCase(),
        phone: nextPayload.phone || null,
        avatar: nextPayload.avatar || null,
        role: nextPayload.role || "user",
        google_id: nextPayload.googleId || null,
        token_version: nextPayload.tokenVersion ?? 0,
        favorites: nextPayload.favorites || [],
        search_history: nextPayload.searchHistory || [],
        email_verified: nextPayload.emailVerified ?? false,
        phone_verified: nextPayload.phoneVerified ?? false,
        last_login: nextPayload.lastLogin || null,
        password: nextPayload.password || null,
        restricted: nextPayload.restricted ?? false,
        verification: nextPayload.verification || {},
      })
      .select(USER_SELECT),
  );

  return mapUser(row);
};

const updateUser = async (id, changes) => {
  const currentUser = await findById(id);
  const nextChanges = applyAvatarPolicyToUpdate(currentUser, changes);
  const payload = {};

  if ("name" in nextChanges) payload.name = nextChanges.name;
  if ("email" in nextChanges && nextChanges.email) {
    payload.email = nextChanges.email.toLowerCase();
  }
  if ("phone" in nextChanges) payload.phone = nextChanges.phone;
  if ("avatar" in nextChanges) payload.avatar = nextChanges.avatar;
  if ("role" in nextChanges) payload.role = nextChanges.role;
  if ("googleId" in nextChanges) payload.google_id = nextChanges.googleId;
  if ("tokenVersion" in nextChanges) {
    payload.token_version = nextChanges.tokenVersion;
  }
  if ("favorites" in nextChanges) payload.favorites = nextChanges.favorites;
  if ("searchHistory" in nextChanges) {
    payload.search_history = nextChanges.searchHistory;
  }
  if ("emailVerified" in nextChanges) {
    payload.email_verified = nextChanges.emailVerified;
  }
  if ("phoneVerified" in nextChanges) {
    payload.phone_verified = nextChanges.phoneVerified;
  }
  if ("lastLogin" in nextChanges) payload.last_login = nextChanges.lastLogin;
  if ("password" in nextChanges) payload.password = nextChanges.password;
  if ("restricted" in nextChanges) payload.restricted = nextChanges.restricted;
  if ("verification" in nextChanges) {
    payload.verification = nextChanges.verification;
  }

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
