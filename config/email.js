const EmailJS = require("@emailjs/nodejs");

// Initialize EmailJS with your credentials
const emailjs = EmailJS.init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY,
});

module.exports = emailjs;
