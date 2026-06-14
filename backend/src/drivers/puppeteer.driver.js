'use strict';

const puppeteer = require('puppeteer');
const os = require('os');
const qrcode = require('qrcode-terminal');
const IWhatsAppDriver = require('./driver.interface');
const { v4: uuidv4 } = require('uuid');

class PuppeteerDriver extends IWhatsAppDriver {
  constructor(stateManager) {
    super(stateManager);
    this.browser = null;
    this.page = null;
    this._qrDataURL = null;
  }

  async init() {
    this.stateManager.transition('booting');

    const platform = os.platform();
    const arch = os.arch();
    this.stateManager.log('info', `[TRACE] System Architecture: ${platform} (${arch}). Browser mapping resolved.`);
    this.stateManager.log('info', "[TRACE] Launching Headless Chromium...");

    const isArmLinux = platform === 'linux' && (arch === 'arm' || arch === 'arm64');
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    };

    if (isArmLinux) {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    }

    try {
      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();
      
      // Defensive Identity Masking
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Bypass WhatsApp's strict Content Security Policy (CSP) to allow our external WPPConnect injection
      await this.page.setBypassCSP(true);

      this.stateManager.log('info', "[TRACE] Navigating to WhatsApp Web...");
      await this.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 60000 });

      // Inject Native Bindings to detect QR or Auth State (run in background to not block server startup)
      this._monitorAuthState().catch(err => {
        this.stateManager.log('error', `[ERROR] Auth monitor crashed: ${err.message}`);
      });

    } catch (error) {
      this.stateManager.log('error', `[FATAL] Puppeteer Initialization crashed: ${error.message}`);
      await this.destroy();
      throw error;
    }
  }

  async _monitorAuthState() {
    this.stateManager.log('info', "[TRACE] Hooking DOM for Authentication State...");
    
    // Polling loop for QR Code or Chat Canvas
    while (this.getState() !== 'cold') {
      try {
        // WhatsApp Web loads the `#side` pane (chat list container) when fully authenticated
        const isReady = await this.page.$('#side') !== null;
        let qrData = null;

        if (!isReady) {
          qrData = await this.page.evaluate(() => {
              const canvas = document.querySelector('canvas');
              return canvas ? canvas.toDataURL() : null;
          });
        }

        if (isReady) {
          // Check if WPP is already injected to survive DOM reloads
          const hasWPP = await this.page.evaluate(() => typeof window.WPP !== 'undefined');
          if (!hasWPP) {
            this.stateManager.log('info', "[TRACE] Injecting WPPConnect...");
            
            // Fetch the raw script in Node.js to bypass any browser-level network/redirect restrictions
            const fetchRes = await fetch('https://github.com/wppconnect-team/wa-js/releases/latest/download/wppconnect-wa.js');
            const scriptContent = await fetchRes.text();

            // Inject the raw JS content directly
            await this.page.addScriptTag({
              content: scriptContent
            });

            // Block until WPP namespace is fully active
            this.stateManager.log('info', "[TRACE] Waiting for WPPConnect initialization...");
            await this.page.waitForFunction(() => window.WPP && window.WPP.isReady, { timeout: 60000 });
          }

          if (this.getState() !== 'ready') {
            this.stateManager.transition('ready');
            this.stateManager.log('info', "[TRACE] WPPConnect verified. WhatsApp Web is CONNECTED and ready.");
          }
          
          // Sleep for 5 seconds then check again, so we never lose injection state if the page refreshes
          await new Promise(r => setTimeout(r, 5000));
          continue;
        } else if (qrData && this.getState() !== 'needsAuth') {
          this.stateManager.transition('needsAuth');
          this.stateManager.log('info', "[TRACE] QR Code detected. Extracting...");
          
          // Extract the actual authentication string from the DOM
          const qrPayload = await this.page.evaluate(() => {
            const el = document.querySelector('[data-ref]');
            return el ? el.getAttribute('data-ref') : null;
          });

          if (qrPayload) {
            this._qrDataURL = qrData;
            // Print clickable link in terminal instead of ASCII QR
            const port = process.env.PORT || 3000;
            const key = process.env.ADMIN_KEY;
            const fs = require('fs');
            const path = require('path');
            const protocol = (fs.existsSync(path.join(__dirname, '../../certs/cert.pem'))) ? 'https' : 'http';
            this.stateManager.log('warn', `⚠️ AUTH REQUIRED: Click this link to scan the QR code: ${protocol}://localhost:${port}/api/admin/auth?key=${key} ⚠️`);
          }
        }
      } catch (error) {
        if (error.message.includes('detached') || error.message.includes('Execution context was destroyed') || error.message.includes('Target closed')) {
          this.stateManager.log('warn', '[TRACE] DOM mutated or closed during monitor read, retrying next cycle...');
        } else {
          this.stateManager.log('error', `[ERROR] Monitor loop exception: ${error.message}`);
        }
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  async sendMessage(to, message) {
    // Defensive state lock
    if (this.getState() !== 'ready') {
      throw new Error(`Cannot dispatch message. Driver state is ${this.getState()}`);
    }

    // Ensure strict JID format with country code (91) if it's missing
    let cleanPhone = to.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }
    const jid = `${cleanPhone}@c.us`;

    this.stateManager.log('info', `[TRACE] Dispatching WPP text payload to ${jid}...`);
    
    try {
      // Evaluate within the page context
      const result = await this.page.evaluate(async (targetJid, text) => {
        if (!window.WPP || !window.WPP.chat) {
          throw new Error('WPP namespace not found on window.');
        }
        const response = await window.WPP.chat.sendTextMessage(targetJid, text);
        return {
          id: response.id || response._serialized || String(response)
        };
      }, jid, message);

      return { success: true, messageId: result.id };
    } catch (error) {
      this.stateManager.log('error', `[ERROR] WPP Injection failed for ${jid}: ${error.message}`);
      throw error;
    }
  }

  async verifyContactExists(phone) {
    // Defensive state lock
    if (this.getState() !== 'ready') {
      throw new Error(`Cannot validate contact. Driver state is ${this.getState()}`);
    }

    // Defensive programming: strip all non-numeric characters and form standard JID
    const numericPhone = String(phone).replace(/\D/g, '');
    const jid = `${numericPhone}@c.us`;

    this.stateManager.log('info', `[TRACE] Validating contact existence for ${jid}...`);

    try {
      // Evaluate within the page context natively using WPPConnect
      const result = await this.page.evaluate(async (targetJid) => {
        if (!window.WPP || !window.WPP.contact) {
          throw new Error('WPP namespace not found on window.');
        }
        
        // Native WPP query
        const exists = await window.WPP.contact.queryExists(targetJid);
        
        // return the result (which is usually an object if exists, or null/false)
        return !!exists; 
      }, jid);

      if (result) {
        return { exists: true, jid };
      }
      return { exists: false };

    } catch (error) {
      this.stateManager.log('error', `[ERROR] WPP Validation failed for ${jid}: ${error.message}`);
      throw error;
    }
  }

  async getContacts() {
    if (this.getState() !== 'ready') {
      throw new Error(`Cannot get contacts. Driver state is ${this.getState()}`);
    }

    try {
      this.stateManager.log('info', '[TRACE] Extracting WhatsApp contacts natively...');
      const contacts = await this.page.evaluate(async () => {
        if (!window.WPP || !window.WPP.contact) {
          throw new Error('WPP namespace not found on window.');
        }
        
        const list = await window.WPP.contact.list();
        return list
          .filter(c => c.isMyContact && c.id && c.id.server === 'c.us') // Only saved personal contacts
          .map(c => ({
            id: c.id._serialized,
            name: c.name || c.pushname || c.shortName || 'Unknown',
            number: c.id.user
          }));
      });

      return contacts;
    } catch (error) {
      this.stateManager.log('error', `[ERROR] Failed to extract contacts: ${error.message}`);
      throw error;
    }
  }

  async getQRDataURL() {
    return this._qrDataURL;
  }

  async destroy() {
    this.stateManager.log('info', "[TRACE] Executing tactical shutdown of Chromium PID...");
    this.stateManager.transition('cold');
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = PuppeteerDriver;
