const express = require('express');
const router = express.Router();
const prisma = require('../../shared/db');
const auth = require('../../shared/middleware/auth');

const INT32_MAX = 2147483647;

function parsePsychologistRouteId(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  const id = Number.parseInt(raw, 10);
  if (id < 1 || id > INT32_MAX) return null;
  return id;
}

// GET /psychologist/:id
router.get('/psychologist/:id', async (req, res) => {
  try {
    const psychologistId = parsePsychologistRouteId(req.params.id);
    if (psychologistId == null) {
      return res.status(400).json({ msg: 'Invalid psychologist ID' });
    }

    const comments = await prisma.comments.findMany({
      where: { psychologistId },
      include: { Users: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = comments.map(({ Users, ...rest }) => ({ ...rest, User: Users || null }));
    res.json(mapped);
  } catch (err) {
    console.error('Error getting comments:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// POST /
router.post('/', auth, async (req, res) => {
  try {
    const { psychologistId, rating, text } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const pid = Number(psychologistId);
    if (!Number.isInteger(pid) || pid < 1 || pid > INT32_MAX) {
      return res.status(400).json({ msg: 'Invalid psychologist ID' });
    }

    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ msg: 'Rating must be an integer between 1 and 5' });
    }

    const comment = await prisma.comments.create({
      data: { userId: req.user.id, psychologistId: pid, rating: r, text: text.trim() },
      include: { Users: { select: { firstName: true, lastName: true } } },
    });

    const { Users, ...rest } = comment;
    res.status(201).json({ ...rest, User: Users || null });
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;
