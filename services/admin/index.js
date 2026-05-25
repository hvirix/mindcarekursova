require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const { corsMiddleware } = require('../../shared/corsConfig');

const app = express();
app.use(corsMiddleware);
app.use(express.json());
// No formatDate middleware — admin routes need raw ISO dates for frontend
app.use('/', require('./routes'));

const PORT = process.env.ADMIN_PORT || 5005;
app.listen(PORT, () => console.log(`Admin service running on port ${PORT}`));
