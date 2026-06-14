'use strict';

/**
 * Abstract base class for WhatsApp drivers.
 *
 * Every concrete driver (Baileys, mock, etc.) must extend this class
 * and override every async method. The default implementations throw
 * so that missing overrides surface immediately at runtime.
 */
class IWhatsAppDriver {
  /**
   * @param {object} stateManager - Shared state-manager instance that
   *   exposes `.transition(state)`, `.getState()`, and `.log()`.
   */
  constructor(stateManager) {
    /** @protected */
    this.stateManager = stateManager;
  }

  /**
   * Start the WhatsApp engine.
   *
   * Expected state flow: cold → booting → needsAuth | ready.
   *
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('Not implemented');
  }

  /**
   * Send a text message to a recipient.
   *
   * @param {string} to      - Recipient phone number / JID.
   * @param {string} message - Message body.
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendMessage(to, message) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieve the current QR code as a base-64 data-URL string.
   *
   * @returns {Promise<string|null>} Data-URL or null when unavailable.
   */
  async getQRDataURL() {
    throw new Error('Not implemented');
  }

  /**
   * Pre-flight check to verify if a contact exists on WhatsApp.
   *
   * @param {string} phone - Phone number to verify.
   * @returns {Promise<{ exists: boolean, jid?: string }>}
   */
  async verifyContactExists(phone) {
    throw new Error('Not implemented');
  }

  /**
   * Retrieves all saved contacts from WhatsApp.
   *
   * @returns {Promise<Array<{id: string, name: string, number: string}>>}
   */
  async getContacts() {
    throw new Error('Not implemented');
  }

  /**
   * Tear down the engine and release all resources.
   *
   * Should transition state back to `cold`.
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    throw new Error('Not implemented');
  }

  /**
   * Return the current driver state (synchronous).
   *
   * @returns {string} Current state string from the state-manager.
   */
  getState() {
    return this.stateManager.getState();
  }
}

module.exports = IWhatsAppDriver;
