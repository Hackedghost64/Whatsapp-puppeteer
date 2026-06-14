'use strict';

/**
 * Factory function that creates the admin controller.
 * @param {object} deps - Dependencies.
 * @param {object} deps.stateManager - Application state manager.
 * @param {object} deps.driver - WhatsApp driver instance.
 * @param {object} deps.queueManager - Message queue manager.
 * @returns {object} Admin controller with route handler methods.
 */
function createAdminController({ stateManager, driver, queueManager }) {
  return {
    /**
     * Returns current system status including uptime, memory, engine state, and queue stats.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    getStatus(req, res) {
      return res.status(200).json({
        uptime: stateManager.getUptime(),
        memoryUsage: process.memoryUsage(),
        engineState: stateManager.getState(),
        queueStats: queueManager.getStats(),
      });
    },

    /**
     * Returns the current QR code as a data URL if authentication is needed.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async getQR(req, res) {
      const state = stateManager.getState();
      if (state !== 'needsAuth') {
        return res.status(400).json({ error: 'QR not available. Current state: ' + state });
      }
      const qr = await driver.getQRDataURL();
      return res.status(200).json({ qr });
    },

    /**
     * Renders a raw HTML page with the QR code. Auto-refreshes every 5s.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async getAuthView(req, res) {
      const state = stateManager.getState();
      if (state !== 'needsAuth') {
         return res.status(200).send(`<html><body><h2>WhatsApp is currently: ${state}</h2></body></html>`);
      }
      
      const qrDataUrl = await driver.getQRDataURL();
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Auth</title>
          <meta http-equiv="refresh" content="5">
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f0f2f5; margin: 0; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
            img { margin-top: 1rem; border: 1px solid #ddd; padding: 10px; border-radius: 4px; max-width: 300px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Scan to Authenticate</h2>
            <p>Point Papa's WhatsApp camera at this QR code.</p>
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="WhatsApp QR Code" />` : '<p><i>Waiting for QR generation...</i></p>'}
          </div>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    },

    /**
     * Restarts the WhatsApp driver and queue manager.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    async restart(req, res) {
      try {
        stateManager.log('warn', 'Admin: Restart requested');
        await queueManager.stop();
        await driver.destroy();
        // Kill zombie chromium processes (best effort)
        try {
          require('child_process').execSync('pkill -f "chromium.*--type=renderer"', { timeout: 5000 });
        } catch (e) {
          /* ignore */
        }
        await driver.init();
        queueManager.start();
        return res.status(200).json({ success: true, state: stateManager.getState() });
      } catch (err) {
        stateManager.log('error', 'Admin: Restart failed', { error: err.message });
        return res.status(500).json({ error: 'Restart failed: ' + err.message });
      }
    },

    /**
     * Returns the collected application logs.
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     */
    getLogs(req, res) {
      return res.status(200).json({ logs: stateManager.getLogs() });
    },
  };
}

module.exports = createAdminController;
