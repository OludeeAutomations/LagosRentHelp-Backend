const supabase = require("../config/supabase");
const { mapNotification } = require("../utils/dbMappers");

const NOTIFICATION_SELECT = `
  id,
  user_id,
  type,
  title,
  message,
  is_read,
  link,
  priority,
  action_required,
  created_at,
  updated_at
`;

const single = async (query) => {
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  link = null,
  priority = "medium",
  actionRequired = false,
}) =>
  mapNotification(
    await single(
      supabase
        .from("notifications")
        .insert({
          user_id: userId,
          type,
          title,
          message,
          link,
          priority,
          action_required: actionRequired,
        })
        .select(NOTIFICATION_SELECT),
    ),
  );

const listNotifications = async ({ userId, page = 1, limit = 10 }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, count, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: (data || []).map(mapNotification),
    total: count || 0,
  };
};

const markNotificationAsRead = async ({ id, userId }) =>
  mapNotification(
    await single(
      supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", userId)
        .select(NOTIFICATION_SELECT),
    ),
  );

const deleteNotification = async ({ id, userId }) => {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
};

module.exports = {
  createNotification,
  deleteNotification,
  listNotifications,
  markNotificationAsRead,
};
