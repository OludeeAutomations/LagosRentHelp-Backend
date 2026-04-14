const ADMIN_IMAGE_ROLES = new Set(["admin", "super_admin"]);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeAvatarValue = (avatar) => {
  if (avatar === null) return null;
  if (typeof avatar !== "string") return avatar;

  const trimmedAvatar = avatar.trim();
  return trimmedAvatar ? trimmedAvatar : null;
};

const canUseAvatar = (role) => ADMIN_IMAGE_ROLES.has(role);

const getDisplayAvatar = (user) => {
  if (!user) return null;

  const avatar = normalizeAvatarValue(user.avatar);
  if (avatar) return avatar;

  if (!canUseAvatar(user.role)) return null;

  return process.env.COMPANY_LOGO_URL || null;
};

const applyAvatarPolicyToCreate = (payload = {}) => {
  const nextPayload = { ...payload };
  const role = nextPayload.role || "user";

  if (!hasOwn(nextPayload, "avatar")) {
    return nextPayload;
  }

  if (nextPayload.avatar === undefined) {
    delete nextPayload.avatar;
    return nextPayload;
  }

  if (!canUseAvatar(role)) {
    delete nextPayload.avatar;
    return nextPayload;
  }

  nextPayload.avatar = normalizeAvatarValue(nextPayload.avatar);
  return nextPayload;
};

const applyAvatarPolicyToUpdate = (currentUser, changes = {}) => {
  const nextChanges = { ...changes };

  if (!hasOwn(nextChanges, "avatar")) {
    return nextChanges;
  }

  if (nextChanges.avatar === undefined) {
    delete nextChanges.avatar;
    return nextChanges;
  }

  const effectiveRole = nextChanges.role ?? currentUser?.role;
  if (!canUseAvatar(effectiveRole)) {
    delete nextChanges.avatar;
    return nextChanges;
  }

  nextChanges.avatar = normalizeAvatarValue(nextChanges.avatar);
  return nextChanges;
};

module.exports = {
  applyAvatarPolicyToCreate,
  applyAvatarPolicyToUpdate,
  canUseAvatar,
  getDisplayAvatar,
};
