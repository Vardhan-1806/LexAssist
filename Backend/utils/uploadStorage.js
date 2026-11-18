const fs = require('fs');
const path = require('path');

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
const documentDirectory = path.join(uploadRoot, 'documents');
const temporaryDirectory = path.join(uploadRoot, 'temp');

const ensureUploadDirectories = () => {
  [uploadRoot, documentDirectory, temporaryDirectory].forEach(directory => {
    fs.mkdirSync(directory, { recursive: true });
  });
};

const documentPath = fileName => path.join(documentDirectory, path.basename(String(fileName || '')));

module.exports = { uploadRoot, documentDirectory, temporaryDirectory, ensureUploadDirectories, documentPath };
