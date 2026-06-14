'use strict';

/**
 * Creates an Express middleware that validates the x-admin-key header.
 * @param {object} config - Application configuration containing adminKey.
 * @returns {function} Express middleware function.
 */
function adminKeyGuard(config) {
  return (req, res, next) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (!key || key !== config.adminKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing Admin API key.' });
    }
    next();
  };
}

/**
 * Creates an Express middleware that validates the x-shop-key header.
 * @param {object} config - Application configuration containing shopKey.
 * @returns {function} Express middleware function.
 */
function shopKeyGuard(config) {
  return (req, res, next) => {
    const key = req.headers['x-shop-key'];
    if (!key || key !== config.shopKey) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing Shop API key.' });
    }
    next();
  };
}

/**
 * Express middleware that validates outbound message payloads.
 * Ensures `to` and `message` are present and `to` matches international JID format.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateOutboundPayload(req, res, next) {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: "Payload rejected: Missing 'to' or 'message' parameters." });
  }
  const phoneRegex = /^\d{10,15}$/;
  if (!phoneRegex.test(to)) {
    return res.status(400).json({ error: 'Payload rejected: Phone format must be numerical international JID format (10-15 digits).' });
  }
  next();
}

/**
 * Express middleware that validates bulk message payloads.
 * Ensures `messages` is a non-empty array and each item has valid `to` and `message` fields.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function validateBulkPayload(req, res, next) {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Payload rejected: 'messages' must be a non-empty array." });
  }
  const phoneRegex = /^\d{10,15}$/;
  for (let i = 0; i < messages.length; i++) {
    const { to, message } = messages[i];
    if (!to || !message) {
      return res.status(400).json({ error: `Payload rejected: Item ${i} missing 'to' or 'message'.` });
    }
    if (!phoneRegex.test(to)) {
      return res.status(400).json({ error: `Payload rejected: Item ${i} phone format invalid.` });
    }
  }
  next();
}

module.exports = {
  adminKeyGuard,
  shopKeyGuard,
  validateOutboundPayload,
  validateBulkPayload,
};
