module.exports = {
  apps: [
    {
      name: "whatsapp-engine",
      script: "../backend/src/server.js",
      cwd: __dirname,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        HEADLESS: "true",
        // NOTE: Inject any sensitive production tokens (like database keys)
        // directly into this file ON THE RASPBERRY PI. This file is committed,
        // but secret values should only be modified on the physical hardware.
      },
    },
  ],
};
