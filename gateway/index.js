require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

const resolveServiceTarget = (url, port) => url || `http://localhost:${port}`;

const SERVICES = {
  auth: {
    port: process.env.AUTH_PORT || 5001,
    target: resolveServiceTarget(process.env.AUTH_URL, process.env.AUTH_PORT || 5001),
  },
  psychologist: {
    port: process.env.PSYCHOLOGIST_PORT || 5002,
    target: resolveServiceTarget(process.env.PSYCHOLOGIST_URL, process.env.PSYCHOLOGIST_PORT || 5002),
  },
  article: {
    port: process.env.ARTICLE_PORT || 5003,
    target: resolveServiceTarget(process.env.ARTICLE_URL, process.env.ARTICLE_PORT || 5003),
  },
  appointment: {
    port: process.env.APPOINTMENT_PORT || 5004,
    target: resolveServiceTarget(process.env.APPOINTMENT_URL, process.env.APPOINTMENT_PORT || 5004),
  },
  admin: {
    port: process.env.ADMIN_PORT || 5005,
    target: resolveServiceTarget(process.env.ADMIN_URL, process.env.ADMIN_PORT || 5005),
  },
  comment: {
    port: process.env.COMMENT_PORT || 5006,
    target: resolveServiceTarget(process.env.COMMENT_URL, process.env.COMMENT_PORT || 5006),
  },
};

const proxy = (target, pathPrefix) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^/api/${pathPrefix}`]: '' },
  });

app.use('/api/auth',           proxy(SERVICES.auth.target,         'auth'));
app.use('/api/psychologists',  proxy(SERVICES.psychologist.target, 'psychologists'));
app.use('/api/articles',       proxy(SERVICES.article.target,      'articles'));
app.use('/api/appointments',   proxy(SERVICES.appointment.target,  'appointments'));
app.use('/api/admin',          proxy(SERVICES.admin.target,        'admin'));
app.use('/api/comments',       proxy(SERVICES.comment.target,      'comments'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => res.json({ status: 'Gateway running', services: SERVICES }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Gateway running on port ${PORT}`));
