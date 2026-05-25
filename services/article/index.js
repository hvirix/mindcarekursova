require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { corsMiddleware } = require('../../shared/corsConfig');

const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use(require('../../shared/middleware/formatDate'));
app.use('/', require('./routes'));

const PORT = process.env.ARTICLE_PORT || 5003;
app.listen(PORT, () => console.log(`Article service running on port ${PORT}`));
