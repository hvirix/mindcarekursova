require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { corsMiddleware } = require('../../shared/corsConfig');

const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use(require('../../shared/middleware/formatDate'));
app.use('/', require('./routes'));

const PORT = process.env.AUTH_PORT || 5001;
app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`));
