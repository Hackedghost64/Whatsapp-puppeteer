'use strict';

/**
 * Factory function that creates the shop controller.
 * @param {object} deps - Dependencies.
 * @param {object} deps.stateManager - Application state manager.
 * @param {object} deps.queueManager - Message queue manager.
 * @returns {object} Shop controller with route handler methods.
 */
function createShopController({ stateManager, queueManager, driver }) {
  return {
    /**
     * Returns whether the system is ready to send messages.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    healthCheck(req, res) {
      return res.status(200).json({ canSend: stateManager.getState() === 'ready' });
    },

    /**
     * Enqueues a single outbound message.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    sendMessage(req, res) {
      try {
        const { to, message } = req.body;
        const id = queueManager.enqueue(to, message);
        return res.status(202).json({ queued: true, id: Number(id) });
      } catch (err) {
        stateManager.log('error', 'Shop: Enqueue failed', { error: err.message });
        return res.status(500).json({ error: 'Failed to enqueue message.' });
      }
    },

    /**
     * Enqueues a batch of outbound messages.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    sendBulk(req, res) {
      try {
        const { messages } = req.body;
        const ids = queueManager.enqueueBulk(messages);
        return res.status(202).json({ queued: true, count: messages.length, ids: ids.map(Number) });
      } catch (err) {
        stateManager.log('error', 'Shop: Bulk enqueue failed', { error: err.message });
        return res.status(500).json({ error: 'Failed to enqueue bulk messages.' });
      }
    },
    /**
     * Validates if a phone number exists on WhatsApp natively.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async validateNumber(req, res) {
      try {
        const { to } = req.body;
        if (!to) {
          return res.status(400).json({ error: "Payload rejected: Missing 'to' parameter." });
        }
        
        const result = await driver.verifyContactExists(to);
        // Do NOT return HTTP 400 or 500 if the number doesn't exist. Return 200 with result.
        return res.status(200).json(result);
      } catch (err) {
        stateManager.log('error', 'Shop: Number validation failed', { error: err.message });
        return res.status(500).json({ error: 'Failed to validate number.' });
      }
    },
    /**
     * Retrieves all saved contacts.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async getContacts(req, res) {
      try {
        const contacts = await driver.getContacts();
        return res.status(200).json({ contacts });
      } catch (err) {
        stateManager.log('error', 'Shop: Failed to get contacts', { error: err.message });
        return res.status(500).json({ error: 'Failed to retrieve contacts.' });
      }
    },
  };
}

module.exports = createShopController;
