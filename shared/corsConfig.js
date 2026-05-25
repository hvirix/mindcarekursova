const cors = require('cors');

/**
 * Origins allowed for browser cross-origin requests to API services.
 * Set CORS_ORIGINS to a comma-separated list (e.g. https://app.example.com,https://staging.example.com).
 * If unset, falls back to FRONTEND_URL (single origin), then local dev defaults.
 */
function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  const single = process.env.FRONTEND_URL?.trim();
  if (single) return [single];
  return ['http://localhost:3000', 'http://localhost:5173'];
}

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    // Non-browser clients (curl, server-side, same-origin) often omit Origin
    if (origin === undefined || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

/** Ready-to-use cors(...) middleware for microservices */
const corsMiddleware = cors(corsOptions);

module.exports = {
  allowedOrigins,
  corsOptions,
  corsMiddleware,
};
