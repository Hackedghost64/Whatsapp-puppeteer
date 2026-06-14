'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend root (two levels up from this file)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Required environment variable keys.
 * @type {string[]}
 */
const REQUIRED_KEYS = [
  'PORT',
  'ADMIN_KEY',
  'SHOP_KEY',
  'QUEUE_DB_PATH',
  'BASE_DELAY_MS',
  'VARIANCE_DELAY_MS',
  'DRIVER_TYPE',
  'LOG_BUFFER_SIZE',
];

// ---------- validation ----------

const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in all values.',
  );
}

const driverType = process.env.DRIVER_TYPE;

if (driverType !== 'mock' && driverType !== 'puppeteer') {
  throw new Error(
    `Invalid DRIVER_TYPE "${driverType}". Must be "mock" or "puppeteer".`,
  );
}

// ---------- exported config ----------

/**
 * Frozen application configuration derived from environment variables.
 *
 * @typedef {Object} AppConfig
 * @property {number}  port            - HTTP listen port.
 * @property {string}  adminKey        - Admin API key.
 * @property {string}  shopKey         - Shop API key.
 * @property {string}  queueDbPath     - Path to the SQLite queue database.
 * @property {number}  baseDelayMs     - Base inter-message delay in ms.
 * @property {number}  varianceDelayMs - Random variance added to delay in ms.
 * @property {string}  driverType      - WhatsApp driver type ('mock' | 'puppeteer').
 * @property {boolean} headless        - Whether to run the browser headless.
 * @property {number}  logBufferSize   - Max entries kept in the circular log buffer.
 */
const config = Object.freeze({
  port: parseInt(process.env.PORT, 10),
  adminKey: process.env.ADMIN_KEY,
  shopKey: process.env.SHOP_KEY,
  queueDbPath: process.env.QUEUE_DB_PATH,
  baseDelayMs: parseInt(process.env.BASE_DELAY_MS, 10),
  varianceDelayMs: parseInt(process.env.VARIANCE_DELAY_MS, 10),
  driverType,
  headless: process.env.HEADLESS !== 'false',
  logBufferSize: parseInt(process.env.LOG_BUFFER_SIZE, 10),
});

module.exports = config;
