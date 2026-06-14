'use strict';

const { Router } = require('express');
const { shopKeyGuard, validateOutboundPayload, validateBulkPayload } = require('../middleware/middleware');

/**
 * Creates the shop API router with key-guard and payload validation middleware.
 * @param {object} config - Application configuration containing shopKey.
 * @param {object} shopController - Shop controller with route handler methods.
 * @returns {import('express').Router} Configured Express router.
 */
function createShopRouter(config, shopController) {
  const router = Router();
  router.use(shopKeyGuard(config));
  router.get('/health', shopController.healthCheck);
  router.post('/send', validateOutboundPayload, shopController.sendMessage);
  router.post('/bulk', validateBulkPayload, shopController.sendBulk);
  router.post('/validate', shopController.validateNumber);
  router.get('/contacts', shopController.getContacts);
  return router;
}

module.exports = createShopRouter;
