#!/bin/bash

# ==========================================
# C.H.A.S.E. Production Setup Installer
# ==========================================

echo "================================================="
echo " Starting C.H.A.S.E. Production Setup...         "
echo "================================================="
echo ""

# ---------------------------------------------------------
# Step 1: System Dependencies
# ---------------------------------------------------------
echo ">>> [Step 1] Installing System Dependencies..."
echo "    [WHY] We need Node.js/npm for the backend engine, PM2 for immortal background processes,"
echo "          and Chromium-Browser for the headless WhatsApp Web automation via Puppeteer."
sudo apt update
sudo apt install -y nodejs chromium-browser
sudo npm install -g pm2
echo "Dependencies installed successfully!"
echo ""

# ---------------------------------------------------------
# Step 2: Interactive .env Generation
# ---------------------------------------------------------
echo ">>> [Step 2] Configuring Environment Variables..."
echo "    [WHY] The backend requires production tokens (like Cloudflare URLs and API keys) to"
echo "          securely interface with your environment and authenticate requests."
ENV_FILE="backend/.env"

if [ -f "$ENV_FILE" ]; then
    echo "Existing .env file detected at $ENV_FILE. Skipping interactive generation."
else
    echo "No .env file found. Initiating interactive generation..."
    
    # Prompt user interactively
    echo ""
    echo "--- 🌐 CLOUDFLARE SETUP ---"
    echo "If you provide a Cloudflare URL, the installer will automatically configure the Flutter"
    echo "app's source code to point to it, enabling immediate remote access out of the box."
    read -p "Enter your Cloudflare URL (or press Enter for localhost): " CLOUDFLARE_URL
    echo ""
    echo "--- 🔑 SECURITY TOKENS ---"
    read -p "Enter your Shop API Key [default: debug_shop_key]: " SHOP_KEY
    SHOP_KEY=${SHOP_KEY:-debug_shop_key}
    read -p "Enter your Admin API Key [default: debug_admin_key]: " ADMIN_KEY
    ADMIN_KEY=${ADMIN_KEY:-debug_admin_key}
    
    # Securely write to .env
    mkdir -p "$(dirname "$ENV_FILE")"
    cat <<EOF > "$ENV_FILE"
# C.H.A.S.E Auto-Generated Environment Variables
PORT=3000
NODE_ENV=production
ADMIN_KEY=$ADMIN_KEY
SHOP_KEY=$SHOP_KEY
QUEUE_DB_PATH=./queue.sqlite
BASE_DELAY_MS=2000
VARIANCE_DELAY_MS=1000
DRIVER_TYPE=puppeteer
LOG_BUFFER_SIZE=100
EOF

    if [ -n "$CLOUDFLARE_URL" ]; then
        echo "CLOUDFLARE_URL=$CLOUDFLARE_URL" >> "$ENV_FILE"
        echo "    [TRACE] Dynamically rewriting Flutter API base URL to $CLOUDFLARE_URL..."
        sed -i "s|defaultValue: 'http://localhost:3000'|defaultValue: '$CLOUDFLARE_URL'|g" apps/shop_app/lib/core/config/api_config.dart
    fi
    
    chmod 600 "$ENV_FILE"
    echo ".env file provisioned securely!"
fi
echo ""

# ---------------------------------------------------------
# Step 3: Node Modules
# ---------------------------------------------------------
echo ">>> [Step 3] Installing Backend Node Modules..."
echo "    [WHY] Fetching required packages like Puppeteer and Express to run the backend engine."
cd backend || { echo "Error: Could not navigate to backend/"; exit 1; }
npm install
echo "Node modules installed!"
echo ""

# ---------------------------------------------------------
# Step 4: PM2 Initialization
# ---------------------------------------------------------
echo ">>> [Step 4] Initializing PM2 Production Matrix..."
echo "    [WHY] PM2 daemonizes the Node.js backend so it runs immortally in the background,"
echo "          auto-restarting if it crashes, keeping your WhatsApp engine online."
cd ../infra/ || { echo "Error: Could not navigate back to infra/"; exit 1; }
pm2 start pm2.config.js
echo "PM2 initialization command executed!"
echo ""

# ---------------------------------------------------------
# Step 5: The Instruction Guide
# ---------------------------------------------------------
echo "=========================================================================="
echo "                   C.H.A.S.E. SYSTEM INITIALIZED                          "
echo "=========================================================================="
echo ""
echo "✅ SUCCESS: The WhatsApp backend engine is now running immortally in the background."
echo ""
echo "🔍 HOW TO VIEW BACKEND LOGS:"
echo "   Monitor real-time engine health and trace payloads via PM2:"
echo "   $ pm2 logs"
echo ""
echo "📱 HOW TO COMPILE THE FLUTTER APPS:"
echo "   With the endpoints now established, you can build your frontend apps."
echo "   Navigate to the target app and run it:"
echo "   $ cd ../apps/shop_app"
echo "   $ flutter pub get"
echo "   $ flutter run"
echo ""
echo "=========================================================================="
