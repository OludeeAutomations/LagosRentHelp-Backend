const getWelcomeEmailTemplate = (user) => {
  return {
    to: user.email,
    subject: `Welcome to RealEstate Pro, ${user.name}!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .button { background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to RealEstate Pro!</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>Thank you for joining RealEstate Pro. We're excited to help you find your perfect property.</p>
            <p>Your account has been successfully created with the role: <strong>${
              user.role
            }</strong>.</p>
            ${
              user.role === "agent"
                ? "<p>As an agent, you can now list properties, manage leads, and grow your business.</p>"
                : "<p>As a user, you can browse properties, save favorites, and contact agents directly.</p>"
            }
            <p style="text-align: center;">
              <a href="${
                process.env.FRONTEND_URL
              }/dashboard" class="button">Go to Dashboard</a>
            </p>
          </div>
          <div class="footer">
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} RealEstate Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Welcome to RealEstate Pro, ${
      user.name
    }!\n\nThank you for joining RealEstate Pro. We're excited to help you find your perfect property.\n\nYour account has been successfully created with the role: ${
      user.role
    }.\n\n${
      user.role === "agent"
        ? "As an agent, you can now list properties, manage leads, and grow your business."
        : "As a user, you can browse properties, save favorites, and contact agents directly."
    }\n\nLogin to your dashboard: ${
      process.env.FRONTEND_URL
    }/dashboard\n\nIf you have any questions, please contact our support team.\n\n© ${new Date().getFullYear()} RealEstate Pro. All rights reserved.`,
  };
};

const getPropertyListingEmailTemplate = (agent, property) => {
  return {
    to: agent.email,
    subject: `Your Property Listing is Live: ${property.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .property-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Property is Now Live!</h1>
          </div>
          <div class="content">
            <h2>Hello ${agent.name},</h2>
            <p>Your property listing has been successfully published and is now visible to potential buyers/renters.</p>
            
            <div class="property-details">
              <h3>${property.title}</h3>
              <p><strong>Location:</strong> ${property.location}</p>
              <p><strong>Price:</strong> $${property.price.toLocaleString()}</p>
              <p><strong>Type:</strong> ${property.type}</p>
              <p><strong>Bedrooms:</strong> ${property.bedrooms}</p>
              <p><strong>Bathrooms:</strong> ${property.bathrooms}</p>
            </div>
            
            <p>You can view and manage your listing from your agent dashboard.</p>
            <p>We'll notify you when someone shows interest in your property.</p>
          </div>
          <div class="footer">
            <p>Happy selling!</p>
            <p>&copy; ${new Date().getFullYear()} RealEstate Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Your Property is Now Live!\n\nHello ${
      agent.name
    },\n\nYour property listing has been successfully published and is now visible to potential buyers/renters.\n\nProperty Details:\n- Title: ${
      property.title
    }\n- Location: ${
      property.location
    }\n- Price: $${property.price.toLocaleString()}\n- Type: ${
      property.type
    }\n- Bedrooms: ${property.bedrooms}\n- Bathrooms: ${
      property.bathrooms
    }\n\nYou can view and manage your listing from your agent dashboard.\n\nWe'll notify you when someone shows interest in your property.\n\nHappy selling!\n\n© ${new Date().getFullYear()} RealEstate Pro. All rights reserved.`,
  };
};

const getLeadNotificationEmailTemplate = (agent, lead, property) => {
  return {
    to: agent.email,
    subject: `New Lead: Interest in ${
      property ? property.title : "Your Listing"
    }`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .lead-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Lead Notification</h1>
          </div>
          <div class="content">
            <h2>Hello ${agent.name},</h2>
            <p>You have a new lead from a potential client interested in your property.</p>
            
            <div class="lead-details">
              <h3>Lead Details</h3>
              <p><strong>Property:</strong> ${
                property ? property.title : "Not specified"
              }</p>
              <p><strong>Lead Type:</strong> ${lead.type
                .replace("_", " ")
                .toUpperCase()}</p>
              <p><strong>Received:</strong> ${new Date(
                lead.timestamp
              ).toLocaleString()}</p>
              ${
                lead.message
                  ? `<p><strong>Message:</strong> ${lead.message}</p>`
                  : ""
              }
            </div>
            
            <p style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/agent/leads/${
      lead.id
    }" class="button">View Lead Details</a>
            </p>
            
            <p>We recommend following up with this lead within 24 hours for best results.</p>
          </div>
          <div class="footer">
            <p>Good luck with your lead!</p>
            <p>&copy; ${new Date().getFullYear()} RealEstate Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `New Lead Notification\n\nHello ${
      agent.name
    },\n\nYou have a new lead from a potential client interested in your property.\n\nLead Details:\n- Property: ${
      property ? property.title : "Not specified"
    }\n- Lead Type: ${lead.type
      .replace("_", " ")
      .toUpperCase()}\n- Received: ${new Date(
      lead.timestamp
    ).toLocaleString()}\n${
      lead.message ? `- Message: ${lead.message}\n` : ""
    }\n\nView lead details: ${process.env.FRONTEND_URL}/agent/leads/${
      lead.id
    }\n\nWe recommend following up with this lead within 24 hours for best results.\n\nGood luck with your lead!\n\n© ${new Date().getFullYear()} RealEstate Pro. All rights reserved.`,
  };
};

const getPasswordResetEmailTemplate = (user, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  return {
    to: user.email,
    subject: "Password Reset Request - RealEstate Pro",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
          .button { background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; }
          .warning { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${user.name},</h2>
            <p>We received a request to reset your password for your RealEstate Pro account.</p>
            
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            
            <p>If you didn't request a password reset, please ignore this email. Your account remains secure.</p>
            
            <p class="warning">This password reset link will expire in 1 hour for security reasons.</p>
            
            <p>Alternatively, you can copy and paste this link in your browser:</p>
            <p>${resetLink}</p>
          </div>
          <div class="footer">
            <p>If you need further assistance, please contact our support team.</p>
            <p>&copy; ${new Date().getFullYear()} RealEstate Pro. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request - RealEstate Pro\n\nHello ${
      user.name
    },\n\nWe received a request to reset your password for your RealEstate Pro account.\n\nTo reset your password, click the following link:\n${resetLink}\n\nIf you didn't request a password reset, please ignore this email. Your account remains secure.\n\nThis password reset link will expire in 1 hour for security reasons.\n\nIf you need further assistance, please contact our support team.\n\n© ${new Date().getFullYear()} RealEstate Pro. All rights reserved.`,
  };
};

module.exports = {
  getWelcomeEmailTemplate,
  getPropertyListingEmailTemplate,
  getLeadNotificationEmailTemplate,
  getPasswordResetEmailTemplate,
};
