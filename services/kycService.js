const axios = require("axios");
const dojahConfig = require("../config/dojahConfig");

class DojahService {
  constructor() {
    this.client = axios.create({
      baseURL: dojahConfig.baseURL,
      headers: {
        AppId: dojahConfig.appId,
        Authorization: dojahConfig.apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  async verifyNIN(nin, selfieImage) {
    try {
      const response = await this.client.post("/api/v1/kyc/nin/verify", {
        nin: nin,
        selfie_image: selfieImage,
      });

      return {
        success: true,
        data: response.data,
        message: "NIN verification completed successfully",
      };
    } catch (error) {
      console.error(
        "Dojah NIN verification error:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: error.response?.data || error.message,
        message: "NIN verification failed",
      };
    }
  }

  async verifyBVN(bvn, selfieImage) {
    try {
      const response = await this.client.post("/api/v1/kyc/bvn/verify", {
        bvn: bvn,
        selfie_image: selfieImage,
      });

      return {
        success: true,
        data: response.data,
        message: "BVN verification completed successfully",
      };
    } catch (error) {
      console.error(
        "Dojah BVN verification error:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: error.response?.data || error.message,
        message: "BVN verification failed",
      };
    }
  }

  async verifyDriversLicense(id, fullName, dateOfBirth) {
    try {
      const response = await this.client.get("/api/v1/gh/kyc/dl", {
        params: {
          id: id,
          full_name: fullName,
          date_of_birth: dateOfBirth,
        },
      });

      return {
        success: true,
        data: response.data,
        message: "Driver's License verification completed successfully",
      };
    } catch (error) {
      console.error(
        "Dojah Driver's License verification error:",
        error.response?.data || error.message
      );
      return {
        success: false,
        error: error.response?.data || error.message,
        message: "Driver's License verification failed",
      };
    }
  }

  async verifyIdentity(
    idType,
    idNumber,
    selfieImage = null,
    additionalData = {}
  ) {
    switch (idType) {
      case "nin":
        return await this.verifyNIN(idNumber, selfieImage);

      case "bvn":
        return await this.verifyBVN(idNumber, selfieImage);

      case "drivers_license":
        return await this.verifyDriversLicense(
          idNumber,
          additionalData.fullName,
          additionalData.dateOfBirth
        );

      default:
        return {
          success: false,
          error: "Unsupported ID type",
          message:
            "Please select a valid ID type (NIN, BVN, or Driver's License)",
        };
    }
  }
}

module.exports = new DojahService();
