const streamifier = require("streamifier");
const { cloudinary } = require("../config/cloudinary");

const uploadToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "lagos-rent-help/uploads", resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

const uploadPropertyImages = async (files = []) => {
  if (!files.length) return [];
  return Promise.all(files.map(uploadToCloudinary));
};

module.exports = { uploadToCloudinary, uploadPropertyImages };
