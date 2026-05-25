const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Upload dirs relative to backend root
const uploadDirs = {
  profile: path.join(__dirname, '../../uploads/photo/profilephoto'),
  articles: path.join(__dirname, '../../uploads/articles'),
  qualifications: path.join(__dirname, '../../uploads/qualifications'),
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirs.profile),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const articleStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirs.articles),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'article-' + (req.user?.id || 'unknown') + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const QUALIFICATION_FILE_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif']);

const qualificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirs.qualifications),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = QUALIFICATION_FILE_EXT.has(ext) ? ext : '';
    cb(null, `qualification-${crypto.randomUUID()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const documentFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and image files (JPEG, PNG, GIF) are allowed for qualification documents!'), false);
  }
};

const upload = multer({ storage: profileStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
const uploadArticle = multer({ storage: articleStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
const uploadQualification = multer({ storage: qualificationStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: documentFileFilter });

module.exports = upload;
module.exports.uploadArticle = uploadArticle;
module.exports.uploadQualification = uploadQualification;
