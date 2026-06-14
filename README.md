# WhatsApp Suite Monorepo (Whatsapp-puppeteer)

A complete, zero-configuration, hardware-agnostic production monorepo designed to deploy a WhatsApp bulk messaging engine on low-RAM Linux devices (such as Raspberry Pi) alongside a Flutter administration app.

## 🏗️ Project Architecture

This monorepo consists of multiple interacting layers:

### 1. The Backend Engine (`whatsapp_backend`)
A Node.js service that orchestrates WhatsApp Web via Puppeteer and WPPConnect.
*   **Global Headless & Hardware-Agnostic Engine:** Dynamically resolves native `/usr/bin/chromium-browser` binaries on ARM/Linux. Unconditionally enforces `headless: 'new'` mode so the monitor never spawns physical windows, maximizing server compatibility.
*   **Low-RAM Protections:** Enforces strict execution arguments (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`) to prevent memory-choking.
*   **Defensive DOM Polling:** Avoids brittle Node-side `ElementHandles` (`page.$`) which crash during WhatsApp React re-renders. All canvas extraction executes natively within the browser context (`page.evaluate()`) wrapped in strict `try/catch` checks for `detached` node exceptions.
*   **Atomic Queue System:** Integrates an SQLite-backed dead-letter `QueueManager`. Bulk messages are tracked in the database. If the server crashes or WhatsApp disconnects, the engine seamlessly pulls failed messages back off the dead-letter queue upon the next `ready` event.
*   **WPPConnect Injection:** Evaluates WhatsApp Web DOM to inject WPP scripts to programmatically dispatch text payloads without the official Cloud API.

### 2. The Frontend Client (`apps/shop_app`)
A Flutter application that manages contacts and dispatches bulk messaging campaigns to the backend API.
*   **State Management:** Utilizes BLoC (`ContactsBloc`) for robust state handling.
*   **Sanitization Layer:** Pre-processes user-input phone numbers, stripping out non-digit characters (`+`, spaces, dashes) using Regex (`r'\D'`) to ensure compliance with the backend's strict payload validation.
*   **Silent Telemetry:** Bypasses visual UI `ScaffoldMessenger` SnackBars for backend/validation failures, instead logging silently to the developer console via `dart:developer`.

### 3. Infrastructure & Deployment (`infra`)
*   **PM2 Matrix:** Managed by `infra/pm2.config.js` (`whatsapp-engine`). Forces `NODE_ENV: "production"` and handles daemonization on target hardware.
*   **Strict Security:** Environment configurations (`.env`, `.env.production`, etc.) are aggressively purged from the Git cache and locked down in `.gitignore` to prevent secret leakage.

---

## 🧪 Research, Failures, and Learnings

Building this system required navigating several undocumented breaking changes from Meta and architectural quirks. Here is the comprehensive development log of failures and solutions:

### Failure 1: The "No LID for user" Exception
*   **The Error:** `WPP Injection failed for 7987866495@c.us: No LID for user`
*   **The Context:** WhatsApp drastically overhauled their internal routing architecture. They stopped accepting purely 10-digit raw phone numbers under the hood. Dispatched messages now require an exact bind to an internal "LID" (Local Identifier node).
*   **The Fix:** This requires a perfectly formatted **International E.164 phone string**. We implemented logic in the Puppeteer driver to evaluate incoming 10-digit numbers and dynamically prefix the `91` (India) country code before appending the `@c.us` domain.

### Failure 2: WPPConnect API Version Mismatch
*   **The Error:** `window.WPP.chat.send is not a function`
*   **The Context:** We attempted to upgrade the DOM dispatch call to `WPP.chat.send()`. However, the specific WPPConnect CDN build being injected into the page was a slightly older stable release where the alias `WPP.chat.send` had not been merged into the prototype chain yet.
*   **The Fix:** Reverted the API call back to the legacy `window.WPP.chat.sendTextMessage(targetJid, text)` while retaining the strict 12-digit formatting fixes from Failure 1.

### Failure 3: Flutter Dynamic Import Rejection
*   **The Error:** `The method 'import' isn't defined... import('dart:developer').then(...)`
*   **The Context:** Attempted to use JavaScript-style Promise-based dynamic imports to lazy-load developer telemetry. Dart compilers strictly reject this.
*   **The Fix:** Enforced strict Dart compliance by moving to top-level static imports (`import 'dart:developer' as developer;`) and calling it synchronously.

### Failure 4: The 400 Bad Request Payload Drop
*   **The Error:** HTTP 400 errors when Flutter sent bulk payloads to the Node.js API.
*   **The Context:** The backend's `validateBulkPayload` middleware enforced a strict `/^\d{10,15}$/` validation. Flutter's raw UI input occasionally passed spaces or plus signs (`+91`), causing the API to immediately drop the payload without executing.
*   **The Fix:** The Flutter `ContactsBloc` was upgraded to map over `targetPhones` and execute `replaceAll(RegExp(r'\D'), '')` prior to assembling the JSON dispatch.

### Failure 5: Detached Canvas ElementHandle Crashes
*   **The Error:** Monitor loop crashes during QR Code rotation with `Execution context was destroyed` or `Node is detached from document`.
*   **The Context:** WhatsApp Web aggressively re-renders the DOM. Using Node.js `page.$('canvas')` created brittle `ElementHandles`. If WhatsApp rotated the QR code a millisecond after the handle was created, Puppeteer would throw a fatal exception when attempting to read the canvas.
*   **The Fix:** Refactored the extraction logic to execute entirely inside the browser context using `page.evaluate()`. Wrapped it in a defensive `try/catch` block that explicitly intercepts `detached` error messages, logging a safe `[TRACE]` warning and gracefully retrying the next cycle without crashing the state machine.

---

## 🚀 Running Locally

**Backend:**
```bash
cd backend
npm install
npm start
```

**Flutter App:**
```bash
cd apps/shop_app
flutter pub get
flutter run
```

## 🔒 Production Deployment (C.H.A.S.E. Installer)

We have implemented an interactive CLI installer script to fully automate the production deployment on fresh environments (like a bare-metal Raspberry Pi).

To initialize the production environment, simply execute the setup installer from the root directory:
```bash
./infra/setup.sh
```

**The C.H.A.S.E. Installer will automatically handle what the system needs and explain why:**
1. **Core System Dependencies (`nodejs`, `chromium-browser`, `pm2`)**
   * *Why?* Node.js executes the backend logic. Chromium-Browser is required for headless WhatsApp Web automation via Puppeteer (essential for Raspberry Pi). PM2 is used to run the engine as a daemon in the background.
2. **Interactive Production Tokens (`.env` file)**
   * *Why?* The backend securely interfaces with external services and requires your specific API keys and Cloudflare URLs to authenticate incoming requests from the Flutter app.
3. **Backend Node.js Modules (`npm install`)**
   * *Why?* Fetches all libraries defined in `package.json` (like `puppeteer-core`, `express`, `sqlite3`) necessary to boot the backend.
4. **Daemonizing the WhatsApp Engine**
   * *Why?* By initializing the PM2 matrix, the Node.js backend runs "immortally." If it crashes or if the hardware reboots, PM2 will automatically restart the process, keeping your WhatsApp engine constantly online.
