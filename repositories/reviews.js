const crypto = require("crypto");
const supabase = require("../config/supabase");
const { mapReview } = require("../utils/dbMappers");

const REVIEW_SELECT = `
  id,
  property_id,
  user_id,
  rating,
  comment,
  is_verified,
  response,
  response_date,
  helpful,
  report_count,
  created_at,
  updated_at,
  user:users!reviews_user_id_fkey(id,name,avatar)
`;

const single = async (query) => {
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
};

const createReview = async (payload) =>
  mapReview(
    await single(
      supabase
        .from("reviews")
        .insert({
          id: crypto.randomUUID(),
          property_id: payload.propertyId,
          user_id: payload.userId,
          rating: payload.rating,
          comment: payload.comment,
          is_verified: payload.isVerified ?? false,
        })
        .select(REVIEW_SELECT),
    ),
  );

const listReviewsByProperty = async (propertyId) => {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapReview);
};

module.exports = {
  createReview,
  listReviewsByProperty,
};
