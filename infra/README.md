# WhatsApp Suite - Infrastructure Playbook

This document outlines the zero-configuration infrastructure required to deploy the WhatsApp Suite onto a raw 64-bit Raspberry Pi OS Lite environment.

## 1. System Architecture & State Mapping

The system follows a strict, unidirectional hardware-agnostic data flow:

1. **Presentation Layer (Flutter):** 
   - Uses strict BLoC state isolation. Dispatches immutable events (`SendBulkMessageRequested`, `ValidatePhoneRequested`).
   - `ApiConfig` dynamically resolves the target gateway via `--dart-define=API_BASE_URL=<tunnel-url>` at compile-time, allowing hot-swapping between the local USB ADB reverse-proxy and the production Cloudflare Tunnel.
2. **Network Gateway (Cloudflare Tunnel / ngrok):**
   - securely routes TLS-encrypted JSON payloads from the distributed Shop App directly into the private Raspberry Pi network boundary.
3. **Controller/Queue (Node.js + SQLite):**
   - Validates the schema.
   - Pushes payloads into an atomic SQLite Dead-Letter Queue (DLQ).
4. **Execution Layer (Puppeteer + WPPConnect):**
   - A Headless Chromium instance natively bridges the DOM.
   - Boot loop explicitly checks `os.platform()` and maps the hardware execution context to `/usr/bin/chromium-browser` when ARM64 is detected.
   - Bypasses security sandboxes to ensure low memory consumption (`--disable-dev-shm-usage`, `--no-sandbox`).

## 2. Raspberry Pi Provisioning

Run the following literal shell commands on a fresh Raspberry Pi OS Lite (64-bit) installation.

### A. Core Dependencies & Chromium
We bypass standard Puppeteer installation since the generic binaries are x86_64 compiled. We natively install the ARM64 optimized Chromium browser via apt.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y chromium-browser chromium-chromedriver git curl build-essential
```

### B. Node.js Environment
Install the LTS Node environment.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### C. Workspace Initialization
Clone the unified monorepo and install backend dependencies. *Note: We skip downloading the heavy x86 Chromium binary during npm install.*

```bash
git clone <your-repo-url> shop_whatsapp
cd shop_whatsapp/backend

# Skip downloading x86 binaries for Puppeteer
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install
```

### D. PM2 Daemon Setup
Use PM2 to ensure the backend daemon survives reboots and crashes.

```bash
sudo npm install -g pm2
pm2 start src/server.js --name "whatsapp-suite"
pm2 save
pm2 startup
```

## 3. Tunneling (Optional but Recommended)
To expose the API securely to Papa's phone outside the local network:

```bash
cloudflared tunnel run whatsapp-shop
```
*(Ensure you update your Flutter build command to point to this new URL).*
