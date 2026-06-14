'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  WhatsApp Suite — HTTP Server Entry Point & Process Handlers
// ─────────────────────────────────────────────────────────────────────────────

const config = require('./config/environment');
const stateManager = require('./services/state.manager');
const QueueManager = require('./services/queue.manager');
const MockDriver = require('./drivers/mock.driver');
const PuppeteerDriver = require('./drivers/puppeteer.driver');
const createAdminController = require('./controllers/admin.controller');
const createShopController = require('./controllers/shop.controller');
const createApp = require('./app');

// ─────────────────────────────────────────────────────────────────────────────
//  Driver Selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Instantiate the correct driver based on DRIVER_TYPE configuration.
 * @returns {import('./drivers/driver.interface')}
 */
function createDriver() {
  if (config.driverType === 'mock') {
    stateManager.log('info', 'Server: Using MockDriver');
    return new MockDriver(stateManager);
  }
  stateManager.log('info', 'Server: Using PuppeteerDriver');
  return new PuppeteerDriver(stateManager, config);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const driver = createDriver();
const queueManager = new QueueManager(driver, stateManager, config);

// Build controllers
const adminController = createAdminController({ stateManager, driver, queueManager });
const shopController = createShopController({ stateManager, queueManager, driver });

// Build Express app
const app = createApp(config, adminController, shopController);

/** @type {import('http').Server|null} */
let server = null;

/**
 * Main startup sequence.
 * 1. Initialise the WhatsApp driver (mock or Puppeteer).
 * 2. Start the queue worker loop.
 * 3. Bind the HTTP server.
 */
async function start() {
  try {
    stateManager.log('info', 'Server: Starting initialisation sequence...');

    // Initialise driver (transitions cold → booting → needsAuth/ready)
    await driver.init();
    stateManager.log('info', `Server: Driver initialised. State: ${stateManager.getState()}`);

    // Start queue worker
    queueManager.start();
    stateManager.log('info', 'Server: Queue worker started');

    // Bind HTTP or HTTPS server
    const fs = require('fs');
    const path = require('path');
    const https = require('https');
    
    const certPath = path.join(__dirname, '../certs/cert.pem');
    const keyPath = path.join(__dirname, '../certs/key.pem');
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      server = https.createServer(options, app).listen(config.port, '0.0.0.0', () => {
        stateManager.log('info', `Server: Listening on port ${config.port} (HTTPS)`);
        console.log(`\n  ✅  WhatsApp Suite secure backend running on https://localhost:${config.port}`);
        console.log(`  🔧  Driver: ${config.driverType}`);
        console.log(`  📊  State : ${stateManager.getState()}\n`);
      });
    } else {
      server = app.listen(config.port, '0.0.0.0', () => {
        stateManager.log('info', `Server: Listening on port ${config.port} (HTTP)`);
        console.log(`\n  ✅  WhatsApp Suite backend running on http://localhost:${config.port}`);
        console.log(`  🔧  Driver: ${config.driverType}`);
        console.log(`  📊  State : ${stateManager.getState()}\n`);
      });
    }
  } catch (err) {
    stateManager.log('error', 'Server: Fatal startup error', { error: err.message, stack: err.stack });
    console.error('❌  Fatal startup error:', err);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gracefully shut down all subsystems in order.
 * @param {string} signal — The signal that triggered the shutdown.
 */
async function shutdown(signal) {
  console.log(`\n  ⏹  ${signal} received. Shutting down gracefully...`);
  stateManager.log('warn', `Server: ${signal} received — shutting down`);

  try {
    // 1. Stop accepting new requests
    if (server && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      stateManager.log('info', 'Server: HTTP server closed');
    }

    // 2. Stop queue processing (waits for current item to finish)
    await queueManager.stop();

    // 3. Destroy driver (closes browser, kills zombies)
    await driver.destroy();

    // 4. Close database
    queueManager.close();

    stateManager.log('info', 'Server: Shutdown complete');
    console.log('  ✅  Shutdown complete.\n');
    process.exit(0);
  } catch (err) {
    stateManager.log('error', 'Server: Error during shutdown', { error: err.message });
    console.error('  ❌  Error during shutdown:', err);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Process Handlers
// ─────────────────────────────────────────────────────────────────────────────

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  stateManager.log('error', 'Uncaught Exception', { error: err.message, stack: err.stack });
  console.error('❌  Uncaught Exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  stateManager.log('error', 'Unhandled Rejection', { reason: msg });
  console.error('❌  Unhandled Rejection:', reason);
});

// ─────────────────────────────────────────────────────────────────────────────
//  Go!
// ─────────────────────────────────────────────────────────────────────────────

start();
