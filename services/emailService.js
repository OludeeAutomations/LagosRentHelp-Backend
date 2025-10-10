// const { send } = require("@emailjs/nodejs"); // import send directly
const emailTemplates = require("../utils/emailTemplates");
const emailjs = require('@emailjs/nodejs');

// Initialize with your keys (optional but recommended)
emailjs.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY, // optional
});
const kycTemplates = {
  success: {
    subject: "✅ KYC Verification Successful 🎉",
    title: "KYC Verification Successful 🎉",
    message:
      "Congratulations! Your identity has been successfully verified. You can now enjoy full access to LagosRentHelp features.",
    icon: "✔",
    iconBg: "#00A73D",
    buttonText: "Go to Dashboard",
    buttonLink: process.env.FRONTEND_URL,
    buttonBg: "#00A73D",

    // ✅ Required template params
    supportLink: "mailto:support@lagosrenthelp.ng", // fallback support link
    Year: new Date().getFullYear(),
    email: "", // to be set dynamically when sending
  },

  failed: {
    subject: "❌ KYC Verification Failed",
    title: "KYC Verification Failed ❌",
    message:
      "Unfortunately, your verification attempt was unsuccessful. Please submit a valid ID and try again, or contact support.",
    icon: "✖",
    iconBg: "#DC2626",
    buttonText: "Retry Verification",
    buttonLink: process.env.FRONTEND_URL + "/agent-signup",
    buttonBg: "#DC2626",

    // ✅ Required template params
    supportLink: "mailto:support@lagosrenthelp.ng",
    Year: new Date().getFullYear(),
    email: "", // to be set dynamically when sending
  },
};





const sendEmail = async (emailData) => {
  try {
    // Use your EmailJS Service ID, Template ID, and Keys here
    const response = await send(
      process.env.EMAILJS_SERVICE_ID,
      emailData.templateId,
      {
        to_email: emailData.to,
        to_name: emailData.toName || "",
        subject: emailData.subject,
        message: emailData.text || "",
        html: emailData.html || "",
      },
      process.env.EMAILJS_PUBLIC_KEY,
      process.env.EMAILJS_PRIVATE_KEY
    );

    console.log("Email sent successfully:", response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

const sendVerificationEmail = async (user) => {
  try {
    const templateParams = {
      FullName: user.name,
      verificationLink:user.verificationLink,
      Email: user.email, // make sure this matches the variable in your EmailJS template
    };

    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_VERIFICATION_TEMPLATE_ID,
      templateParams
      // publicKey/privateKey are optional here since we initialized globally
    );

    console.log("Email sent successfully!", response);
    return { success: true };
  } catch (error) {
    console.error("FAILED...", error);
    return { success: false, error: error.message };
  }
};
// Wrap templates for easier use
const sendWelcomeEmail = async (user) => {
  const roleMessage =
    user.role === 'agent'
      ? "As an agent, you can now list properties, manage leads, and grow your business."
      : "As a user, you can browse properties, save favorites, and contact agents directly.";

  const templateParams = {
    FullName: user.name,
    Role: user.role,
    RoleMessage: roleMessage,
    DashboardLink: `${process.env.FRONTEND_URL}`,
    Year: new Date().getFullYear(),
    email: user.email, // must match the EmailJS variable if used
  };

  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_WELCOME_TEMPLATE_ID,
      templateParams,
    );

    console.log('Email sent successfully!', response);
    return { success: true };
  } catch (error) {
    console.error('FAILED...', error);
    return { success: false, error: error.message };
  }
};

const sendResetPasswordEmail = async (user) => {

  const templateParams = {
    FullName: user.name,
    resetLink:user.resetLink,
    Year: new Date().getFullYear(),
    email: user.email, // match your EmailJS template variable for recipient
  };

  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_RESET_PASSWORD_TEMPLATE_ID, // your reset template ID
      templateParams
    );

    console.log("✅ Password reset email sent:", response.status, response.text);
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to send reset email:", error);
    return { success: false, error: error.message };
  }
};

const sendResetPasswordSuccessEmail = async (user) => {
  const templateParams = {
    FullName: user.name,
    email: user.email,
    Year: new Date().getFullYear(),
  };

  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_RESET_PASSWORD_SUCCESS_TEMPLATE_ID, // create this template in EmailJS
      templateParams,
    );

    console.log("Password reset success email sent!", response.status, response.text);
    return { success: true };
  } catch (error) {
    console.error("FAILED to send reset success email...", error);
    return { success: false, error: error.message };
  }
};


const sendKycResponse = async (user, status) => {
  const templateData = kycTemplates[status];

  if (!templateData) {
    throw new Error("Invalid KYC status");
  }

  // ✅ Match exactly the variables in your EmailJS template
  const templateParams = {
    FullName: user.name || "User",
    email: user.email,
    subject: templateData.subject || "KYC Update",
    title: templateData.title || "",
    message: templateData.message || "",
    icon: templateData.icon || "",
    iconBg: templateData.iconBg || "#000000",
    buttonText: templateData.buttonText || "",
    buttonLink: templateData.buttonLink || process.env.FRONTEND_URL || "#",
    buttonBg: templateData.buttonBg || "#000000",
    supportLink: templateData.supportLink || "mailto:support@lagosrenthelp.ng",
    Year: String(new Date().getFullYear()), // force string
  };

  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_KYC_TEMPLATE_ID,
      templateParams,
      process.env.EMAILJS_PUBLIC_KEY // required for client-side calls
    );

    console.log("✅ KYC status email sent", response.status, response.text);
    return { success: true };
  } catch (error) {
    console.error("❌ FAILED to send KYC status email", error);
    return { success: false, error: error.message };
  }
};


const sendPropertyListingEmail = async (agent, property) => {
  const emailTemplate = emailTemplates.getPropertyListingEmailTemplate(
    agent,
    property
  );

  // return await sendEmail({
  //   to: agent.email,
  //   toName: agent.name,
  //   ...emailTemplate,
  // });


   const templateParams = {
    email: agent.email,
    message : emailTemplate.text,
    subject : emailTemplate.subject
  };

  try {
    const response = await emailjs.send(
      process.env.EMAILJS_SERVICE_ID,
      process.env.EMAILJS_UNIVERSAL_TEMPLATE_ID, // create this template in EmailJS
      templateParams,
    );

    console.log("Universal email sent!", response.status, response.text);
    return { success: true };
  } catch (error) {
    console.error("FAILED to send universal email...", error);
    return { success: false, error: error.message };
  }
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
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendResetPasswordSuccessEmail,
  sendKycResponse
};
