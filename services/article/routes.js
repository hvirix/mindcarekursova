const express = require('express');
const router = express.Router();
const prisma = require('../../shared/db');
const auth = require('../../shared/middleware/auth');
const authorizeRoles = require('../../shared/middleware/authorizeRoles');
const optionalAuth = require('../../shared/middleware/optionalAuth');
const { uploadArticle } = require('../../shared/middleware/upload');
const { markdownToHtml, htmlToMarkdown } = require('../../shared/utils/markdown');

// GET / - published articles
router.get('/', async (req, res) => {
  try {
    const articles = await prisma.articles.findMany({
      where: { status: 'published' },
      include: { Users: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(articles);
  } catch (err) {
    console.error('Error getting articles:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /user/my - must be before /:id
router.get('/user/my', auth, async (req, res) => {
  try {
    const articles = await prisma.articles.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(articles);
  } catch (err) {
    console.error('Error getting user articles:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const articleId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(articleId)) return res.status(400).json({ error: 'Invalid article ID' });

    const article = await prisma.articles.findUnique({
      where: { id: articleId },
      include: { Users: { select: { firstName: true, lastName: true } } },
    });
    if (!article) return res.status(404).json({ error: 'Article not found' });

    const user = req.user;
    const isPublished = article.status === 'published';
    const isAdmin = user?.role === 'admin';
    const isAuthor = Boolean(user && article.userId != null && user.id === article.userId);
    if (!isPublished && !isAdmin && !isAuthor) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const editMode = req.query.edit === 'true';
    if (editMode && req.user && article.content) {
      const isAuthor = req.user.id === article.userId;
      const isAdmin = req.user.role === 'admin';
      if (isAuthor || isAdmin) {
        try {
          article.contentMarkdown = htmlToMarkdown(article.content);
        } catch (err) {
          article.contentMarkdown = article.content;
        }
      }
    }

    res.json(article);
  } catch (err) {
    console.error('Error getting article:', err);
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// POST /
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'psychologist' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { title, description, image, readTime, author, content, status } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const htmlContent = content ? markdownToHtml(content) : null;
    let articleStatus = status || 'draft';
    if (req.user.role === 'psychologist' && articleStatus === 'published') {
      articleStatus = 'pending';
    }

    const article = await prisma.articles.create({
      data: { title, description: description || null, image: image || null, readTime: readTime || null, author: author || null, content: htmlContent, status: articleStatus, userId: req.user.id },
    });

    if (articleStatus === 'published') {
      const { notifyUsersAboutArticle } = require('../../shared/utils/email');
      notifyUsersAboutArticle(article).catch(err => console.error('Error sending article notifications:', err));
    }

    res.json(article);
  } catch (err) {
    console.error('Error creating article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// PUT /:id
router.put('/:id', auth, async (req, res) => {
  try {
    const article = await prisma.articles.findUnique({ where: { id: Number.parseInt(req.params.id, 10) } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (article.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { title, description, image, readTime, author, content, status } = req.body;
    const htmlContent = content !== undefined ? (content ? markdownToHtml(content) : null) : article.content;
    let articleStatus = status !== undefined ? status : article.status;

    let updateData = {
      title: title !== undefined ? title : article.title,
      description: description !== undefined ? description : article.description,
      image: image !== undefined ? image : article.image,
      readTime: readTime !== undefined ? readTime : article.readTime,
      author: author !== undefined ? author : article.author,
      content: htmlContent,
    };

    if (req.user.role === 'psychologist' && articleStatus === 'published') articleStatus = 'pending';
    if (articleStatus === 'pending' && article.rejectionReason) updateData.rejectionReason = null;
    updateData.status = articleStatus;

    const updatedArticle = await prisma.articles.update({
      where: { id: Number.parseInt(req.params.id, 10) },
      data: updateData,
    });

    if (articleStatus === 'published' && article.status !== 'published') {
      const { notifyUsersAboutArticle } = require('../../shared/utils/email');
      notifyUsersAboutArticle(updatedArticle).catch(err => console.error('Error sending article notifications:', err));
    }

    res.json(updatedArticle);
  } catch (err) {
    console.error('Error updating article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// DELETE /:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const article = await prisma.articles.findUnique({ where: { id: Number.parseInt(req.params.id, 10) } });
    if (!article) return res.status(404).json({ error: 'Article not found' });
    if (article.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    await prisma.articles.delete({ where: { id: Number.parseInt(req.params.id, 10) } });
    res.json({ message: 'Article deleted' });
  } catch (err) {
    console.error('Error deleting article:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST /upload-image
router.post('/upload-image', auth, authorizeRoles('psychologist', 'admin'), uploadArticle.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    res.json({ imageUrl: `/uploads/articles/${req.file.filename}` });
  } catch (err) {
    console.error('Upload image error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;
