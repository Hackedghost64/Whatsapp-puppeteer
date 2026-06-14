'use strict';

const { EventEmitter } = require('events');

/**
 * Valid application states.
 * @type {string[]}
 */
const VALID_STATES = ['cold', 'booting', 'needsAuth', 'ready', 'error'];

/**
 * Map of legal state transitions.
 * Key = current state, Value = array of allowed next states.
 * @type {Record<string, string[]>}
 */
const TRANSITIONS = Object.freeze({
  cold: ['booting'],
  booting: ['needsAuth', 'ready', 'error'],
  needsAuth: ['ready', 'error', 'cold'],
  ready: ['error', 'cold'],
  error: ['cold'],
});

/**
 * Singleton state manager for the WhatsApp Suite backend.
 *
 * Tracks application lifecycle state with validated transitions and
 * maintains an in-memory circular log buffer.
 *
 * @extends EventEmitter
 */
class StateManager extends EventEmitter {
  /**
   * Create a StateManager instance.
   *
   * @param {Object}  [options={}]                - Configuration options.
   * @param {number}  [options.logBufferSize=200]  - Maximum number of log entries to keep.
   */
  constructor(options = {}) {
    super();

    /** @private */
    this._state = 'cold';

    /** @private */
    this._logBufferSize = (options && options.logBufferSize) || 200;

    /**
     * Circular log buffer (newest entries at the end).
     * @private
     * @type {Array<{timestamp: string, level: string, message: string, meta: Object}>}
     */
    this._logs = [];
  }

  // ---------- state helpers ----------

  /**
   * Return the current application state.
   *
   * @returns {string} One of the VALID_STATES values.
   */
  getState() {
    return this._state;
  }

  /**
   * Transition to a new state.
   *
   * The transition must be listed in the TRANSITIONS map; otherwise an Error
   * is thrown.  On success the 'stateChange' event is emitted with
   * `{ from, to, timestamp }`.
   *
   * @param {string} newState - The target state.
   * @throws {Error} If the transition is not allowed.
   */
  transition(newState) {
    if (!VALID_STATES.includes(newState)) {
      throw new Error(`Invalid state: "${newState}". Valid states are: ${VALID_STATES.join(', ')}`);
    }

    const allowed = TRANSITIONS[this._state];

    if (!allowed || !allowed.includes(newState)) {
      throw new Error(
        `Illegal state transition: "${this._state}" -> "${newState}". ` +
          `Allowed transitions from "${this._state}": [${(allowed || []).join(', ')}]`,
      );
    }

    const from = this._state;
    this._state = newState;

    const payload = { from, to: newState, timestamp: new Date().toISOString() };

    this.log('info', `State transition: ${from} -> ${newState}`);
    this.emit('stateChange', payload);
  }

  // ---------- logging helpers ----------

  /**
   * Append a log entry to the circular buffer.
   *
   * If the buffer is full the oldest entry is dropped.
   *
   * @param {string} level   - Log severity (e.g. 'info', 'warn', 'error').
   * @param {string} message - Human-readable message.
   * @param {Object} [meta={}] - Optional structured metadata.
   */
  log(level, message, meta = {}) {
    /** @type {{timestamp: string, level: string, message: string, meta: Object}} */
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };

    if (this._logs.length >= this._logBufferSize) {
      this._logs.shift(); // drop oldest
    }

    this._logs.push(entry);

    // Also print to console so worker activity is visible in the terminal
    const prefix = { error: '❌', warn: '⚠️ ', info: 'ℹ️ ', debug: '🔍' }[level] || '  ';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} [${level.toUpperCase()}] ${message}${metaStr}`);
  }

  /**
   * Return a shallow copy of all log entries currently in the buffer.
   *
   * @returns {Array<{timestamp: string, level: string, message: string, meta: Object}>}
   */
  getLogs() {
    return [...this._logs];
  }

  // ---------- misc ----------

  /**
   * Return the process uptime in seconds.
   *
   * @returns {number} Seconds since the Node.js process started.
   */
  getUptime() {
    return process.uptime();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — lazily requires config so the module can also be
// imported in test environments where .env may not exist.
// ---------------------------------------------------------------------------

let logBufferSize = 200;

try {
  // eslint-disable-next-line global-require
  const config = require('../config/environment');
  logBufferSize = config.logBufferSize || 200;
} catch (_) {
  // Config not available (e.g. in unit tests) — use default.
}

/** @type {StateManager} */
const instance = new StateManager({ logBufferSize });

module.exports = instance;
module.exports.StateManager = StateManager;
