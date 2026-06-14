'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const createAdminRouter = require('./routes/admin.routes');
const createShopRouter = require('./routes/shop.routes');

/**
 * Creates and configures the Express application.
 * @param {object} config - Application configuration (adminKey, shopKey, etc.).
 * @param {object} adminController - Admin controller with route handler methods.
 * @param {object} shopController - Shop controller with route handler methods.
 * @returns {import('express').Application} Configured Express application.
 */
function createApp(config, adminController, shopController) {
  const app = express();

  // Security & parsing middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      // Log is available via stateManager but we keep this lightweight
      if (process.env.NODE_ENV !== 'test') {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // Mount routers
  app.use('/api/admin', createAdminRouter(config, adminController));
  app.use('/api/shop', createShopRouter(config, shopController));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Global error handler
  app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

module.exports = createApp;
