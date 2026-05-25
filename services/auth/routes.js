const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../shared/db');
const auth = require('../../shared/middleware/auth');
const upload = require('../../shared/middleware/upload');
const uploadQualification = upload.uploadQualification;

// POST /register — patients only. Psychologists use /register-psychologist. Admins: /api/admin/create-admin or scripts/createAdmin.js
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  try {
    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const userRole = 'patient';

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
        firstName,
        lastName,
      },
    });

    const payload = { user: { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: payload.user });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: payload.user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET /me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      include: {
        Psychologists: {
          include: {
            QualificationDocuments: { orderBy: { uploadedAt: 'desc' } },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    let userData = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      emailNotifications: user.emailNotifications ?? true,
    };

    if (user.Psychologists && user.Psychologists.length > 0) {
      const psychologist = user.Psychologists[0];
      userData.psychologist = {
        specialization: psychologist.specialization,
        experience: psychologist.experience,
        bio: psychologist.bio,
        qualificationDocument: psychologist.qualificationDocument,
        qualificationDocuments: psychologist.QualificationDocuments?.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          fileUrl: doc.fileUrl,
          fileSize: doc.fileSize,
          isVerified: doc.isVerified,
          uploadedAt: doc.uploadedAt,
          updatedAt: doc.updatedAt,
        })) || [],
        updatedAt: psychologist.updatedAt,
        price: psychologist.price != null ? Number.parseFloat(psychologist.price.toString()) : null,
      };
    }

    const newToken = jwt.sign(
      { user: { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName } },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ ...userData, token: newToken });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// POST /refresh
router.post('/refresh', auth, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const newToken = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token: newToken });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// PUT /settings/email-notifications
router.put('/settings/email-notifications', auth, async (req, res) => {
  try {
    const { emailNotifications } = req.body;
    if (typeof emailNotifications !== 'boolean') {
      return res.status(400).json({ error: 'emailNotifications must be a boolean' });
    }

    const updatedUser = await prisma.users.update({
      where: { id: req.user.id },
      data: { emailNotifications },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, photoUrl: true, emailNotifications: true },
    });
    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating email notifications settings:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /register-psychologist
router.post('/register-psychologist', uploadQualification.single('qualificationDocument'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, specialization, experience, bio, price, role: clientRole } = req.body;

    if (clientRole !== undefined && String(clientRole).trim().toLowerCase() === 'admin') {
      return res.status(403).json({ msg: 'Invalid role' });
    }

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    if (!specialization || !String(specialization).trim()) {
      return res.status(400).json({ msg: 'Specialization is required' });
    }
    if (!req.file) {
      return res.status(400).json({ msg: 'Qualification document is required' });
    }

    const userRole = 'psychologist';

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const qualificationDocumentUrl = `/uploads/qualifications/${req.file.filename}`;

    const exp = experience !== undefined && experience !== '' ? Number.parseInt(String(experience), 10) : 0;
    if (Number.isNaN(exp) || exp < 0) {
      return res.status(400).json({ msg: 'Invalid experience value' });
    }
    const pr = price !== undefined && price !== '' ? Number.parseFloat(String(price)) : 0;
    if (Number.isNaN(pr) || pr < 0) {
      return res.status(400).json({ msg: 'Invalid price value' });
    }

    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
        firstName,
        lastName,
        Psychologists: {
          create: {
            specialization: String(specialization).trim(),
            experience: exp,
            bio: bio != null ? String(bio) : null,
            price: pr,
            status: 'pending',
            qualificationDocument: qualificationDocumentUrl,
            QualificationDocuments: {
              create: {
                filename: req.file.originalname,
                fileUrl: qualificationDocumentUrl,
                fileSize: req.file.size,
                isVerified: false,
              },
            },
          },
        },
      },
    });

    const payload = { user: { id: user.id, role: user.role, email: user.email, firstName: user.firstName, lastName: user.lastName } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({
      token,
      user: payload.user,
      message: 'Реєстрацію успішно завершено. Ваш профіль очікує на підтвердження адміністратором.',
    });
  } catch (err) {
    console.error('Psychologist registration error:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ msg: 'File too large. Maximum size is 10MB' });
    if (err.message.includes('Only PDF and image files')) return res.status(400).json({ msg: 'Only PDF and image files (JPEG, PNG, GIF) are allowed' });
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /upload-photo
router.post('/upload-photo', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const photoUrl = `/uploads/photo/profilephoto/${req.file.filename}`;
    await prisma.users.update({ where: { id: req.user.id }, data: { photoUrl } });
    res.json({ photoUrl });
  } catch (err) {
    console.error('Upload photo error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ msg: 'File too large. Maximum size is 10MB' });
    if (err.message === 'Only image files are allowed!') return res.status(400).json({ msg: 'Only image files are allowed' });
    res.status(500).json({ msg: 'Server Error' });
  }
});

// POST /upload-qualification
router.post('/upload-qualification', auth, uploadQualification.single('qualificationDocument'), async (req, res) => {
  try {
    if (req.user.role !== 'psychologist') {
      return res.status(403).json({ msg: 'Only psychologists can upload qualification documents' });
    }
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const qualificationDocumentUrl = `/uploads/qualifications/${req.file.filename}`;
    const psychologist = await prisma.psychologists.findFirst({ where: { userId: req.user.id } });
    if (!psychologist) return res.status(404).json({ msg: 'Psychologist profile not found' });

    const document = await prisma.qualificationDocument.create({
      data: {
        filename: req.file.originalname,
        fileUrl: qualificationDocumentUrl,
        fileSize: req.file.size,
        isVerified: false,
        psychologistId: psychologist.id,
      },
    });

    res.json({
      id: document.id,
      filename: document.filename,
      fileUrl: document.fileUrl,
      fileSize: document.fileSize,
      isVerified: document.isVerified,
      uploadedAt: document.uploadedAt,
    });
  } catch (err) {
    console.error('Upload qualification error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ msg: 'File too large. Maximum size is 10MB' });
    res.status(500).json({ msg: 'Server Error' });
  }
});

// DELETE /qualification/:id
router.delete('/qualification/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'psychologist') {
      return res.status(403).json({ msg: 'Only psychologists can delete qualification documents' });
    }

    const documentId = Number.parseInt(req.params.id, 10);
    const psychologist = await prisma.psychologists.findFirst({ where: { userId: req.user.id } });
    if (!psychologist) return res.status(404).json({ msg: 'Psychologist profile not found' });

    const document = await prisma.qualificationDocument.findFirst({
      where: { id: documentId, psychologistId: psychologist.id },
    });
    if (!document) return res.status(404).json({ msg: 'Qualification document not found' });

    await prisma.qualificationDocument.delete({ where: { id: documentId } });
    res.json({ msg: 'Qualification document deleted successfully' });
  } catch (err) {
    console.error('Delete qualification error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
