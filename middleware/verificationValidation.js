// middleware/verificationValidation.js
const { body } = require("express-validator");

exports.validateVerification = [
  body("idType")
    .isIn(["nin", "bvn", "drivers_license"])
    .withMessage("ID type must be nin, bvn, or drivers_license"),

  body("idNumber")
    .isLength({ min: 11 })
    .withMessage("ID number must be at least 10 characters"),

  body("fullName")
    .if(body("idType").equals("drivers_license"))
    .notEmpty()
    .withMessage("Full name is required for Driver's License verification"),

  body("dateOfBirth")
    .if(body("idType").equals("drivers_license"))
    .isISO8601()
    .withMessage(
      "Valid date of birth is required for Driver's License verification"
    ),
];
