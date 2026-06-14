'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * QueueManager — Server-side FIFO throttled queue backed by SQLite.
 *
 * Ingests outbound message requests, persists them to a local SQLite database,
 * and drains them one-at-a-time through the active WhatsApp driver with
 * randomized anti-ban delays between dispatches.
 */
class QueueManager {
  /**
   * @param {import('../drivers/driver.interface')} driver  — WhatsApp driver instance.
   * @param {import('./state.manager')}             stateManager — Global state & logger.
   * @param {object}                                config — Parsed environment config.
   */
  constructor(driver, stateManager, config) {
    this._driver = driver;
    this._stateManager = stateManager;
    this._running = false;
    this._loopPromise = null;
    this._baseDelay = config.baseDelayMs || 2000;
    this._varianceDelay = config.varianceDelayMs || 3000;

    // --------------- SQLite initialisation ---------------
    const resolvedPath = path.resolve(process.cwd(), config.queueDbPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    this._db = new Database(resolvedPath);
    this._db.pragma('journal_mode = WAL');

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS queue (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        phone      TEXT    NOT NULL,
        message    TEXT    NOT NULL,
        status     TEXT    NOT NULL DEFAULT 'queued',
        created_at TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
        result     TEXT
      )
    `);

    // --------------- Prepared statements ---------------
    this._insertStmt = this._db.prepare(
      'INSERT INTO queue (phone, message) VALUES (?, ?)'
    );
    this._getNextStmt = this._db.prepare(
      "SELECT * FROM queue WHERE status = 'queued' ORDER BY id ASC LIMIT 1"
    );
    this._updateStatusStmt = this._db.prepare(
      "UPDATE queue SET status = ?, result = ?, updated_at = datetime('now') WHERE id = ?"
    );
    this._statsStmt = this._db.prepare(
      'SELECT status, COUNT(*) as count FROM queue GROUP BY status'
    );

    this._stateManager.log('info', 'QueueManager: Initialised', { db: resolvedPath });
  }

  // =====================================================
  //  Public API
  // =====================================================

  /**
   * Enqueue a single outbound message.
   * @param {string} to      — Phone number (digits only, E.164-ish).
   * @param {string} message — Message body text.
   * @returns {number} Row ID of the inserted queue entry.
   */
  enqueue(to, message) {
    const info = this._insertStmt.run(to, message);
    this._stateManager.log('info', `QueueManager: Enqueued #${info.lastInsertRowid} -> ${to}`);
    return info.lastInsertRowid;
  }

  /**
   * Enqueue a batch of outbound messages inside a single transaction.
   * @param {Array<{to: string, message: string}>} items
   * @returns {number[]} Array of inserted row IDs.
   */
  enqueueBulk(items) {
    const insertMany = this._db.transaction((rows) => {
      const ids = [];
      for (const row of rows) {
        const info = this._insertStmt.run(row.to, row.message);
        ids.push(info.lastInsertRowid);
      }
      return ids;
    });

    const ids = insertMany(items);
    this._stateManager.log('info', `QueueManager: Bulk-enqueued ${ids.length} messages`);
    return ids;
  }

  /**
   * Start the single-threaded worker loop.
   */
  start() {
    this._running = true;
    this._loopPromise = this._workerLoop();
    this._stateManager.log('info', 'QueueManager: Worker started');
  }

  /**
   * Gracefully stop the worker loop.  Resolves once the current item (if any)
   * finishes processing.
   */
  async stop() {
    this._running = false;
    if (this._loopPromise) {
      await this._loopPromise;
      this._loopPromise = null;
    }
    this._stateManager.log('info', 'QueueManager: Worker stopped');
  }

  /**
   * Returns aggregate counts grouped by queue status.
   * @returns {object} e.g. { queued: 5, sent: 120, failed: 2 }
   */
  getStats() {
    const rows = this._statsStmt.all();
    return Object.fromEntries(rows.map((r) => [r.status, r.count]));
  }

  /**
   * Close the underlying SQLite connection.  Call during shutdown.
   */
  close() {
    try {
      this._db.close();
      this._stateManager.log('info', 'QueueManager: Database closed');
    } catch (err) {
      this._stateManager.log('error', 'QueueManager: Error closing database', {
        error: err.message,
      });
    }
  }

  // =====================================================
  //  Internal
  // =====================================================

  /**
   * Core async worker loop — processes one queue item at a time with
   * anti-ban throttling.
   * @private
   */
  async _workerLoop() {
    while (this._running) {
      try {
        // 1. Fetch oldest queued row
        const row = this._getNextStmt.get();

        if (!row) {
          await this._sleep(500);
          continue;
        }

        // 2. Wait for driver readiness
        if (this._stateManager.getState() !== 'ready') {
          this._stateManager.log('warn', 'QueueManager: Driver not ready, pausing...');
          await this._sleep(1000);
          continue;
        }

        // 3. Mark as processing
        this._updateStatusStmt.run('processing', null, row.id);
        this._stateManager.log('info', `QueueManager: Processing #${row.id} -> ${row.phone}`);

        // 4. Dispatch to driver
        try {
          const result = await this._driver.sendMessage(row.phone, row.message);
          this._updateStatusStmt.run('sent', JSON.stringify(result), row.id);
          this._stateManager.log('info', `QueueManager: Sent #${row.id}`, result);
        } catch (sendErr) {
          this._updateStatusStmt.run(
            'failed',
            JSON.stringify({ error: sendErr.message }),
            row.id
          );
          this._stateManager.log('error', `QueueManager: Failed #${row.id}`, {
            error: sendErr.message,
          });
        }

        // 5. Anti-ban delay:  Δt = t_base + Math.random() × t_variance
        const delay = this._baseDelay + Math.random() * this._varianceDelay;
        this._stateManager.log('debug', `QueueManager: Sleeping ${Math.round(delay)}ms before next`);
        await this._sleep(delay);
      } catch (loopErr) {
        this._stateManager.log('error', 'QueueManager: Loop error', {
          error: loopErr.message,
        });
        await this._sleep(2000);
      }
    }
  }

  /**
   * Promise-based sleep helper.
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = QueueManager;
