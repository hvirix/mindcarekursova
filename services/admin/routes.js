const express = require('express');
const router = express.Router();
const prisma = require('../../shared/db');
const auth = require('../../shared/middleware/auth');
const bcrypt = require('bcryptjs');

const adminAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden - Admin access required' });
  next();
};

// GET /stats
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const [totalArticles, totalPsychologists, totalUsers, recentArticles, recentPsychologists] = await Promise.all([
      prisma.articles.count(),
      prisma.psychologists.count(),
      prisma.users.count(),
      prisma.articles.findMany({ take: 5, orderBy: { updatedAt: 'desc' }, include: { Users: { select: { firstName: true, lastName: true } } } }),
      prisma.psychologists.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { Users: { select: { firstName: true, lastName: true, email: true } } } }),
    ]);

    const recentActivity = [];

    for (const article of recentArticles) {
      const time = article.updatedAt || article.createdAt;
      if (time) {
        recentActivity.push({
          type: article.status === 'published' ? 'article_published' : 'article_updated',
          title: article.title || 'Без назви',
          author: article.Users ? `${article.Users.firstName || ''} ${article.Users.lastName || ''}`.trim() || 'Невідомий автор' : 'Невідомий автор',
          time,
        });
      }
    }

    for (const psychologist of recentPsychologists) {
      if (psychologist.Users) {
        const time = psychologist.createdAt || psychologist.updatedAt;
        if (time) {
          recentActivity.push({
            type: 'psychologist_registered',
            title: `${psychologist.Users.firstName || ''} ${psychologist.Users.lastName || ''}`.trim() || 'Невідомий психолог',
            author: psychologist.Users.email || '',
            time,
          });
        }
      }
    }

    recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      stats: { totalArticles, totalPsychologists, totalUsers },
      recentActivity: recentActivity.slice(0, 5).map(activity => ({
        type: activity.type,
        title: activity.title,
        subtitle: activity.author,
        time: activity.time instanceof Date ? activity.time.toISOString() : new Date(activity.time).toISOString(),
      })),
    });
  } catch (err) {
    console.error('Error getting admin stats:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /psychologists/pending
router.get('/psychologists/pending', auth, adminAuth, async (req, res) => {
  try {
    const psychologists = await prisma.psychologists.findMany({
      where: { status: 'pending' },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(psychologists.map(({ Users, price, ...rest }) => ({
      ...rest,
      User: Users || null,
      price: price != null ? Number.parseFloat(price.toString()) : null,
    })));
  } catch (err) {
    console.error('Error getting pending psychologists:', err);
    res.status(500).json({ error: 'Server Error', message: process.env.NODE_ENV === 'development' ? err.message : 'Server Error' });
  }
});

// GET /psychologists
router.get('/psychologists', auth, adminAuth, async (req, res) => {
  try {
    const psychologists = await prisma.psychologists.findMany({
      include: {
        Users: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true, role: true } },
        Comments: { select: { rating: true } },
      },
    });

    res.json(psychologists.map(({ Comments, Users, price, ...rest }) => {
      const averageRating = Comments.length > 0 ? Comments.reduce((acc, c) => acc + c.rating, 0) / Comments.length : 0;
      return {
        ...rest,
        User: Users ? { ...Users, role: Users.role || 'psychologist' } : null,
        price: price != null ? parseFloat(price.toString()) : null,
        averageRating: Math.round(averageRating * 10) / 10,
        totalComments: Comments.length,
      };
    }));
  } catch (err) {
    console.error('Error getting psychologists for admin:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /psychologists/:id
router.get('/psychologists/:id', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });

    const psychologist = await prisma.psychologists.findUnique({
      where: { id: psychologistId },
      include: {
        Users: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true, role: true } },
        Comments: { include: { Users: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });

    const { Users, Comments, price, ...rest } = psychologist;
    const averageRating = Comments.length > 0 ? Comments.reduce((acc, c) => acc + c.rating, 0) / Comments.length : 0;
    const mappedComments = Comments.map(({ Users: u, ...c }) => ({ ...c, User: u || null }));

    res.json({
      ...rest,
      User: Users ? { ...Users, role: Users.role || 'psychologist' } : null,
      price: price != null ? parseFloat(price.toString()) : null,
      averageRating: Math.round(averageRating * 10) / 10,
      totalComments: mappedComments.length,
      Comments: mappedComments,
    });
  } catch (err) {
    console.error('Error getting psychologist details for admin:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /psychologists/:id/approve
router.post('/psychologists/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });

    const psychologist = await prisma.psychologists.findUnique({ where: { id: psychologistId } });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });

    const updated = await prisma.psychologists.update({
      where: { id: psychologistId },
      data: { status: 'approved' },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true } } },
    });

    const { Users, price, ...rest } = updated;
    res.json({ ...rest, User: Users || null, price: price != null ? parseFloat(price.toString()) : null });
  } catch (err) {
    console.error('Error approving psychologist:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /psychologists/:id/reject
router.post('/psychologists/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });

    const psychologist = await prisma.psychologists.findUnique({ where: { id: psychologistId } });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });

    const updated = await prisma.psychologists.update({
      where: { id: psychologistId },
      data: { status: 'rejected' },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true } } },
    });

    const { Users, price, ...rest } = updated;
    res.json({ ...rest, User: Users || null, price: price != null ? parseFloat(price.toString()) : null });
  } catch (err) {
    console.error('Error rejecting psychologist:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /psychologists/:id/block-temporary
router.post('/psychologists/:id/block-temporary', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    const { days } = req.body;

    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });
    if (!days || days < 1) return res.status(400).json({ error: 'Days must be a positive number' });

    const psychologist = await prisma.psychologists.findUnique({ where: { id: psychologistId }, include: { Users: true } });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });
    if (!psychologist.Users) return res.status(404).json({ error: 'User not found for this psychologist' });

    const blockUntil = new Date();
    blockUntil.setDate(blockUntil.getDate() + days);

    const [updatedUser, updatedPsychologist] = await prisma.$transaction([
      prisma.users.update({ where: { id: psychologist.Users.id }, data: { role: 'patient' } }),
      prisma.psychologists.update({
        where: { id: psychologistId },
        data: {
          blockedPermanently: false,
          blockedUntil: blockUntil,
        },
      }),
    ]);

    res.json({
      message: `Psychologist blocked temporarily for ${days} days`,
      blockUntil: updatedPsychologist.blockedUntil.toISOString(),
      user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
    });
  } catch (err) {
    console.error('Error blocking psychologist temporarily:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /psychologists/:id/block-permanent
router.post('/psychologists/:id/block-permanent', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });

    const psychologist = await prisma.psychologists.findUnique({ where: { id: psychologistId }, include: { Users: true } });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });
    if (!psychologist.Users) return res.status(404).json({ error: 'User not found for this psychologist' });

    const [updatedUser, updatedPsychologist] = await prisma.$transaction([
      prisma.users.update({ where: { id: psychologist.Users.id }, data: { role: 'patient' } }),
      prisma.psychologists.update({
        where: { id: psychologistId },
        data: {
          blockedPermanently: true,
          blockedUntil: null,
        },
      }),
    ]);
    res.json({
      message: 'Psychologist blocked permanently',
      user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      psychologist: { id: updatedPsychologist.id, blockedPermanently: updatedPsychologist.blockedPermanently, blockedUntil: updatedPsychologist.blockedUntil },
    });
  } catch (err) {
    console.error('Error blocking psychologist permanently:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /psychologists/:id/unblock
router.post('/psychologists/:id/unblock', auth, adminAuth, async (req, res) => {
  try {
    const psychologistId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(psychologistId)) return res.status(400).json({ error: 'Invalid psychologist ID' });

    const psychologist = await prisma.psychologists.findUnique({ where: { id: psychologistId }, include: { Users: true } });
    if (!psychologist) return res.status(404).json({ error: 'Psychologist not found' });
    if (!psychologist.Users) return res.status(404).json({ error: 'User not found for this psychologist' });

    const [updatedUser, updatedPsychologist] = await prisma.$transaction([
      prisma.users.update({ where: { id: psychologist.Users.id }, data: { role: 'psychologist' } }),
      prisma.psychologists.update({
        where: { id: psychologistId },
        data: {
          blockedPermanently: false,
          blockedUntil: null,
        },
      }),
    ]);
    res.json({
      message: 'Psychologist unblocked',
      user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      psychologist: { id: updatedPsychologist.id, blockedPermanently: updatedPsychologist.blockedPermanently, blockedUntil: updatedPsychologist.blockedUntil },
    });
  } catch (err) {
    console.error('Error unblocking psychologist:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /articles/pending
router.get('/articles/pending', auth, adminAuth, async (req, res) => {
  try {
    const articles = await prisma.articles.findMany({
      where: { status: 'pending' },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(articles);
  } catch (err) {
    console.error('Error getting pending articles:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /articles/all
router.get('/articles/all', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const where = {};

    if (status && status !== 'all') where.status = status;

    const searchTerm = search?.trim();
    if (searchTerm) {
      const searchConditions = {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { Users: { is: { OR: [{ firstName: { contains: searchTerm, mode: 'insensitive' } }, { lastName: { contains: searchTerm, mode: 'insensitive' } }, { email: { contains: searchTerm, mode: 'insensitive' } }] } } },
        ],
      };
      if (where.status) {
        where.AND = [{ status: where.status }, searchConditions];
        delete where.status;
      } else {
        Object.assign(where, searchConditions);
      }
    }

    const skip = (Number.parseInt(page, 10) - 1) * Number.parseInt(limit, 10);
    const take = Number.parseInt(limit, 10);

    const [articles, total] = await Promise.all([
      prisma.articles.findMany({ where, include: { Users: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.articles.count({ where }),
    ]);

    res.json({ articles, total, page: Number.parseInt(page, 10), limit: take, totalPages: Math.ceil(total / take) });
  } catch (err) {
    console.error('Error getting all articles:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /articles/:id/approve
router.post('/articles/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const articleId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });

    const article = await prisma.articles.findUnique({ where: { id: articleId } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (article.status !== 'pending') return res.status(400).json({ error: 'Article is not pending moderation' });

    const updated = await prisma.articles.update({
      where: { id: articleId },
      data: { status: 'published' },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    const { notifyUsersAboutArticle } = require('../../shared/utils/email');
    notifyUsersAboutArticle(updated).catch(err => console.error('Error sending article notifications:', err));

    res.json(updated);
  } catch (err) {
    console.error('Error approving article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /articles/:id/reject
router.post('/articles/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const articleId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });

    const { rejectionReason } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) return res.status(400).json({ error: "Причина відхилення обов'язкова" });

    const article = await prisma.articles.findUnique({ where: { id: articleId }, include: { Users: { select: { id: true, firstName: true, lastName: true, email: true, emailNotifications: true } } } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (article.status !== 'pending') return res.status(400).json({ error: 'Article is not pending moderation' });

    const updated = await prisma.articles.update({
      where: { id: articleId },
      data: { status: 'draft', rejectionReason: rejectionReason.trim() },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true, emailNotifications: true } } },
    });

    if (article.Users?.email && article.Users.emailNotifications) {
      const { sendArticleRejectionNotification } = require('../../shared/utils/email');
      const authorName = article.Users.firstName && article.Users.lastName
        ? `${article.Users.firstName} ${article.Users.lastName}`
        : article.Users.email;
      sendArticleRejectionNotification(article.Users.email, authorName, updated, rejectionReason.trim())
        .catch(err => console.error('Error sending article rejection email:', err));
    }

    res.json(updated);
  } catch (err) {
    console.error('Error rejecting article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// PUT /articles/:id/status
router.put('/articles/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const articleId = Number.parseInt(req.params.id, 10);
    const { status } = req.body;

    if (Number.isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });
    if (!status || !['draft', 'pending', 'published'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const articleBeforeUpdate = await prisma.articles.findUnique({ where: { id: articleId } });
    if (!articleBeforeUpdate) return res.status(404).json({ error: 'Article not found' });

    const updated = await prisma.articles.update({
      where: { id: articleId },
      data: { status },
      include: { Users: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    if (status === 'published' && articleBeforeUpdate.status !== 'published') {
      const { notifyUsersAboutArticle } = require('../../shared/utils/email');
      notifyUsersAboutArticle(updated).catch(err => console.error('Error sending article notifications:', err));
    }

    res.json(updated);
  } catch (err) {
    console.error('Error updating article status:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// DELETE /articles/:id
router.delete('/articles/:id', auth, adminAuth, async (req, res) => {
  try {
    const articleId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });

    const article = await prisma.articles.findUnique({ where: { id: articleId } });
    if (!article) return res.status(404).json({ error: 'Article not found' });

    await prisma.articles.delete({ where: { id: articleId } });
    res.json({ message: 'Article deleted successfully' });
  } catch (err) {
    console.error('Error deleting article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /create-admin
router.post('/create-admin', auth, adminAuth, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters long' });

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User with this email already exists' });

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const admin = await prisma.users.create({ data: { email, password: hashedPassword, role: 'admin', firstName: firstName || '', lastName: lastName || '' } });

    // eslint-disable-next-line no-unused-vars
    const { password: _, ...adminWithoutPassword } = admin;
    res.json({ message: 'Admin account created successfully', user: adminWithoutPassword });
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

module.exports = router;
