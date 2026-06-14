'use strict';

const { Router } = require('express');
const { adminKeyGuard } = require('../middleware/middleware');

/**
 * Creates the admin API router with key-guard middleware applied.
 * @param {object} config - Application configuration containing adminKey.
 * @param {object} adminController - Admin controller with route handler methods.
 * @returns {import('express').Router} Configured Express router.
 */
function createAdminRouter(config, adminController) {
  const router = Router();
  router.use(adminKeyGuard(config));
  router.get('/status', adminController.getStatus);
  router.get('/qr', adminController.getQR);
  router.get('/auth', adminController.getAuthView);
  router.post('/restart', adminController.restart);
  router.get('/logs', adminController.getLogs);
  return router;
}

module.exports = createAdminRouter;
