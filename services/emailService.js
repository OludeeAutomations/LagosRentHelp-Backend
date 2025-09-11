const emailjs = require("../config/email");
const emailTemplates = require("../utils/emailTemplates");

const sendEmail = async (emailData) => {
  try {
    const response = await emailjs.send({
      from: {
        name: process.env.EMAIL_FROM_NAME || "RealEstate Pro",
        email: process.env.EMAIL_FROM_ADDRESS || "noreply@realestatepro.com",
      },
      to: [
        {
          name: emailData.toName || "",
          email: emailData.to,
        },
      ],
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });

    console.log("Email sent successfully:", response);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (user) => {
  const emailTemplate = emailTemplates.getWelcomeEmailTemplate(user);
  return await sendEmail({
    to: user.email,
    toName: user.name,
    ...emailTemplate,
  });
};

const sendPropertyListingEmail = async (agent, property) => {
  const emailTemplate = emailTemplates.getPropertyListingEmailTemplate(
    agent,
    property
  );
  return await sendEmail({
    to: agent.email,
    toName: agent.name,
    ...emailTemplate,
  });
};

const sendLeadNotificationEmail = async (agent, lead, property) => {
  const emailTemplate = emailTemplates.getLeadNotificationEmailTemplate(
    agent,
    lead,
    property
  );
  return await sendEmail({
    to: agent.email,
    toName: agent.name,
    ...emailTemplate,
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const emailTemplate = emailTemplates.getPasswordResetEmailTemplate(
    user,
    resetToken
  );
  return await sendEmail({
    to: user.email,
    toName: user.name,
    ...emailTemplate,
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPropertyListingEmail,
  sendLeadNotificationEmail,
  sendPasswordResetEmail,
};
