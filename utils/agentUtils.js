/**
 * Determines whether an agent can list properties
 */
const canAgentListProperties = (agent) => {
  if (!agent || agent.verificationStatus !== "verified") {
    return false;
  }

  const now = new Date();

  // ✅ 1. Free listing weeks from referrals
  if (agent.freeListingWeeks && agent.freeListingWeeks > 0) {
    return true;
  }

  // ✅ 2. Active trial period
  if (
    agent.subscription?.status === "trial" &&
    agent.subscription.trialStartsAt &&
    agent.subscription.trialEndsAt
  ) {
    const trialStarts = new Date(agent.subscription.trialStartsAt);
    const trialEnds = new Date(agent.subscription.trialEndsAt);
    return now >= trialStarts && now <= trialEnds;
  }

  // ✅ 3. Active paid subscription
  if (
    agent.subscription?.status === "active" &&
    agent.subscription.currentPeriodEnd
  ) {
    const periodEnd = new Date(agent.subscription.currentPeriodEnd);
    return now <= periodEnd;
  }

  // ✅ 4. Grace period: 7 days after verification
  // FIX: Check both possible locations for verifiedAt
  const verifiedAt = agent.verifiedAt || agent.dojahResponse?.verifiedAt;
  if (verifiedAt) {
    const verifiedDate = new Date(verifiedAt);
    const sevenDaysLater = new Date(
      verifiedDate.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    // Allow listing if within 7 days of verification
    if (now <= sevenDaysLater) {
      return true;
    }
  }

  // ❌ Otherwise, not allowed
  return false;
};

/**
 * Returns a human-readable subscription status
 */
const getAgentSubscriptionStatus = (agent) => {
  if (!agent) return "Loading...";

  if (agent.verificationStatus !== "verified") {
    return "Not Verified";
  }

  if (agent.freeListingWeeks && agent.freeListingWeeks > 0) {
    return `Free Weeks: ${agent.freeListingWeeks}`;
  }

  if (
    agent.subscription?.status === "trial" &&
    agent.subscription.trialEndsAt
  ) {
    const daysLeft = Math.ceil(
      (new Date(agent.subscription.trialEndsAt).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );
    return `Trial: ${daysLeft} days left`;
  }

  if (agent.subscription?.status === "active") {
    return "Active Subscription";
  }

  // ✅ Grace period display - FIX: Check both locations
  const verifiedAt = agent.verifiedAt || agent.dojahResponse?.verifiedAt;
  if (verifiedAt) {
    const verifiedDate = new Date(verifiedAt);
    const daysSinceVerification = Math.floor(
      (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceVerification < 7) {
      const daysLeft = 7 - daysSinceVerification;
      return `Grace Period: ${daysLeft} days left`;
    }
  }

  return "Subscription Required";
};

/**
 * Get days remaining in grace period
 */
const getGracePeriodDaysRemaining = (agent) => {
  if (!agent) return 0;

  const verifiedAt = agent.verifiedAt || agent.verificationData?.verifiedAt;
  if (!verifiedAt) return 0;

  const verifiedDate = new Date(verifiedAt);
  const daysSinceVerification = Math.floor(
    (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, 7 - daysSinceVerification);
};

/**
 * Check if agent is in grace period
 */
const isInGracePeriod = (agent) => {
  return getGracePeriodDaysRemaining(agent) > 0;
};

module.exports = {
  canAgentListProperties,
  getAgentSubscriptionStatus,
  getGracePeriodDaysRemaining,
  isInGracePeriod,
};
