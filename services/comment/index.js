require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { corsMiddleware } = require('../../shared/corsConfig');

const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use(require('../../shared/middleware/formatDate'));
app.use('/', require('./routes'));

const PORT = process.env.COMMENT_PORT || 5006;
app.listen(PORT, () => console.log(`Comment service running on port ${PORT}`));
