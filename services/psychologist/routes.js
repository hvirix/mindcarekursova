const express = require('express');
const router = express.Router();
const prisma = require('../../shared/db');
const auth = require('../../shared/middleware/auth');
const {
  publicPsychologistWhere,
  expireTemporaryPsychologistBlocks,
} = require('../../shared/utils/psychologistPublicAccess');

const INT32_MAX = 2147483647;

function parseRequiredIntId(raw, res) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    res.status(400).json({ msg: 'Invalid psychologist id' });
    return null;
  }
  const id = Number.parseInt(raw, 10);
  if (id < 1 || id > INT32_MAX) {
    res.status(400).json({ msg: 'Invalid psychologist id' });
    return null;
  }
  return id;
}

// GET /
router.get('/', async (req, res) => {
  try {
    await expireTemporaryPsychologistBlocks(prisma);
    const psychologists = await prisma.psychologists.findMany({
      where: publicPsychologistWhere(),
      include: {
        Users: { select: { firstName: true, lastName: true, role: true, photoUrl: true } },
      },
    });
    const mapped = psychologists.map(({ Users, price, blockedUntil, blockedPermanently, ...rest }) => ({
      ...rest,
      User: Users || null,
      price: price != null ? parseFloat(price.toString()) : null,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Error getting psychologists:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const id = parseRequiredIntId(req.params.id, res);
    if (id == null) return;

    await expireTemporaryPsychologistBlocks(prisma);
    const psychologist = await prisma.psychologists.findFirst({
      where: { id, ...publicPsychologistWhere() },
      include: {
        Users: { select: { firstName: true, lastName: true, role: true, photoUrl: true } },
      },
    });
    if (!psychologist) return res.status(404).json({ msg: 'Psychologist not found' });

    const { Users, price, blockedUntil, blockedPermanently, ...rest } = psychologist;
    res.json({ ...rest, User: Users || null, price: price != null ? parseFloat(price.toString()) : null });
  } catch (err) {
    console.error('Error getting psychologist:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// PUT /profile
router.put('/profile', auth, async (req, res) => {
  try {
    const userFields = ['firstName', 'lastName', 'email'];
    const psychologistFields = ['specialization', 'experience', 'bio', 'price'];

    const userData = {};
    const psychologistData = {};

    for (const key of Object.keys(req.body)) {
      if (userFields.includes(key)) userData[key] = req.body[key];
    }
    if (req.user.role === 'psychologist') {
      for (const key of Object.keys(req.body)) {
        if (psychologistFields.includes(key)) psychologistData[key] = req.body[key];
      }
    }

    if (Object.keys(userData).length > 0 || (req.user.role === 'psychologist' && Object.keys(psychologistData).length > 0)) {
      await prisma.$transaction(async tx => {
        if (Object.keys(userData).length > 0) {
          await tx.users.update({ where: { id: req.user.id }, data: userData });
        }
        if (req.user.role === 'psychologist' && Object.keys(psychologistData).length > 0) {
          await tx.psychologists.upsert({
            where: { userId: req.user.id },
            update: psychologistData,
            create: { userId: req.user.id, ...psychologistData },
          });
        }
      });
    }

    res.json({ msg: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
