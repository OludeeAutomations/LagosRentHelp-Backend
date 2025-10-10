const axios = require("axios");
const FormData = require("form-data");
const User = require("../models/User");
const Agent = require("../models/Agent");



const { sendKycResponse} = require("../services/emailService");


async function verifyWithDidIt(frontImageUrl, userId) {
  try {
    // 1. Fetch user and agent
    const user = await User.findById(userId);
    const agent = await Agent.findOne({ userId });

    if (!user) throw new Error("User not found");
    if (!agent) throw new Error("Agent not found");

    // 2. Download file from Cloudinary
    const imageResponse = await axios.get(frontImageUrl, {
      responseType: "arraybuffer",
    });

    // 3. Build FormData for DidIt
    const formData = new FormData();
    formData.append("vendor_data", userId);
    formData.append("front_image", Buffer.from(imageResponse.data), {
      filename: "id.png",
      contentType: "image/png",
    });

    // 4. Call DidIt API
    const response = await axios.post(
      `${process.env.DIDIT_BASE_URL}/id-verification/`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "x-api-key": process.env.DIDIT_API_KEY,
        },
      }
    );

    const result = response.data;

    // 5. Check verification result
    const status = result?.status || result?.data?.status;
    let verificationPassed = false;

    // DidIt might return "success" or "verified" or true (normalize it)
    if (
      status === "success" ||
      status === "verified" ||
      status === true ||
      result?.verified === true
    ) {
      verificationPassed = true;
    }

    // 6. Update agent + send KYC email
    if (!verificationPassed) {
      agent.verificationStatus = "rejected";
      await agent.save();
      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "failed"
      );
    } else {
      agent.verificationStatus = "verified";
      await agent.save();
      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "success"
      );
    }

    return result;
  } catch (error) {
    console.error("DidIt API Error:", error.response?.data || error.message);
    throw error;
  }
}

async function verifyWithDojah(frontImageUrl, userId) {
  function mapTextData(textData) {
    const mapped = {};
    if (Array.isArray(textData)) {
      textData.forEach((field) => {
        mapped[field.field_key] = field.value;
      });
    }
    return mapped;
  }

  try {
    const user = await User.findById(userId);
    const agent = await Agent.findOne({ userId: userId });

    if (!user) {
      console.error("User not found");
      throw new Error("User not found");
    }

    if (!agent) {
      console.error("Agent not found");
      throw new Error("Agent not found");
    }

    const payload = {
      input_type: "url",
      imagefrontside: frontImageUrl,
    };

    const response = await axios.post(
      `${process.env.DOJAH_BASE_URL}/api/v1/document/analysis`,
      payload,
      {
        headers: {
          Authorization: process.env.DOJAH_SECRET_KEY,
          AppId: process.env.DOJAH_APP_ID,
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data;
    const overallStatus = result?.entity?.status?.overall_status;

    const extracted = mapTextData(result?.entity?.text_data);

    const extractedFirstName = extracted.first_name || "";
    const extractedLastName = extracted.last_name || "";

    let isUserMatch = true;

    if (user.name) {
      const fullName = `${extractedFirstName} ${extractedLastName}`.trim().toLowerCase();
      if (!fullName.includes(user.name.toLowerCase())) {
        isUserMatch = false;
      }
    }


    if (overallStatus === 0 || !isUserMatch) {
      agent.verificationStatus = "rejected";
      await agent.save();

      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "failed"
      );
    } else {
      agent.verificationStatus = "verified";
      await agent.save();

      await sendKycResponse(
        {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        "success"
      );
    }

    return result;
  } catch (error) {
    console.error("Dojah API Error:", error.response?.data || error.message);
    throw error;
  }
}


module.exports = {
    verifyWithDidIt,
    verifyWithDojah
}