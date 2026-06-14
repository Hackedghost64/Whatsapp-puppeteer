'use strict';

const { v4: uuidv4 } = require('uuid');
const IWhatsAppDriver = require('./driver.interface');

/**
 * Small async helper – pauses execution for the given number of
 * milliseconds.  Used to simulate real-world latency in the mock.
 *
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mock WhatsApp driver used for stress-testing and local development.
 *
 * It follows the same lifecycle as a real driver but replaces all
 * network I/O with deterministic (or slightly randomised) timers.
 *
 * @extends IWhatsAppDriver
 */
class MockDriver extends IWhatsAppDriver {
  /**
   * @param {object} stateManager - Shared state-manager instance.
   */
  constructor(stateManager) {
    super(stateManager);

    /** @private */
    this._qrDataURL = null;
  }

  /**
   * Simulate the full boot → QR → auth lifecycle.
   *
   * 1. Transition to `booting` and pause briefly.
   * 2. Generate a fake QR data-URL, transition to `needsAuth`.
   * 3. Simulate a user scanning the QR code, then transition to `ready`.
   *
   * @returns {Promise<void>}
   */
  async init() {
    this.stateManager.transition('booting');
    console.log('MockDriver: Booting...');

    await sleep(500);

    this._qrDataURL = 'data:image/png;base64,MOCK_QR_' + Date.now();
    this.stateManager.transition('needsAuth');
    console.log('MockDriver: QR generated, waiting for scan...');

    await sleep(1000);

    this.stateManager.transition('ready');
    console.log('MockDriver: Authenticated. Ready.');
  }

  /**
   * Simulate sending a message with a small random delay.
   *
   * @param {string} to      - Recipient identifier.
   * @param {string} message  - Message body.
   * @returns {Promise<{ success: boolean, messageId: string }>}
   * @throws {Error} If the driver is not in the `ready` state.
   */
  async sendMessage(to, message) {
    if (this.getState() !== 'ready') {
      throw new Error('Driver not ready');
    }

    const delay = 100 + Math.random() * 200;
    await sleep(delay);

    const messageId = uuidv4();

    this.stateManager.log('info', `MockDriver: Sent message to ${to}`, {
      messageId,
      delay: Math.round(delay),
    });

    return { success: true, messageId };
  }

  /**
   * Mock implementation of number validation.
   * Strips non-numeric characters and checks length >= 10.
   */
  async verifyContactExists(phone) {
    if (this.getState() !== 'ready') {
      throw new Error('Driver not ready');
    }
    
    // Defensive programming: strip all non-numeric characters
    const numericPhone = String(phone).replace(/\D/g, '');
    
    this.stateManager.log('info', `MockDriver: Validating contact ${numericPhone}...`);
    await sleep(200); // Simulate network latency

    if (numericPhone.length >= 10) {
      return { exists: true, jid: `${numericPhone}@c.us` };
    }
    return { exists: false };
  }

  /**
   * Mock implementation to retrieve dummy contacts.
   */
  async getContacts() {
    if (this.getState() !== 'ready') {
      throw new Error('Driver not ready');
    }
    await sleep(300);
    return [
      { id: '919876543210@c.us', name: 'John Doe', number: '919876543210' },
      { id: '919000000001@c.us', name: 'Jane Smith', number: '919000000001' },
      { id: '919000000002@c.us', name: 'Local Vendor', number: '919000000002' }
    ];
  }

  /**
   * Return the most recently generated QR data-URL.
   *
   * @returns {Promise<string|null>}
   */
  async getQRDataURL() {
    return this._qrDataURL;
  }

  /**
   * Tear down the mock driver and reset state to `cold`.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    this._qrDataURL = null;
    this.stateManager.transition('cold');
    this.stateManager.log('info', 'MockDriver: Destroyed.');
  }
}

module.exports = MockDriver;
