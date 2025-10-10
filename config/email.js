const { init } = require('@emailjs/nodejs');

// Initialize once with your keys
const emailjs = init({
  publicKey: process.env.EMAILJS_PUBLIC_KEY,
  privateKey: process.env.EMAILJS_PRIVATE_KEY, // optional
});

module.exports = emailjs; 
