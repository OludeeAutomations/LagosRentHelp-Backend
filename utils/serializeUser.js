const { getDisplayAvatar } = require("../services/userAvatarService");

const serializeUser = (user) => {
  if (!user) return null;

  const safeUser = { ...user };
  delete safeUser.password;
  delete safeUser.verification;
  safeUser.displayAvatar = getDisplayAvatar(user);

  return safeUser;
};

module.exports = {
  serializeUser,
};
