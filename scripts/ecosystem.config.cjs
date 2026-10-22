const path = require('node:path');

// PM2 evaluates this file on the VPS, not in the application's SSR bundle.
const cwd = path.resolve(__dirname, '..');
process.loadEnvFile(path.join(cwd, '.env'));

module.exports = {
  apps: [{
    name: 'evenon-gpt',
    cwd,
    script: '.output/server/index.mjs',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      NITRO_HOST: '127.0.0.1',
      PORT: '3000',
      NITRO_PORT: '3000',
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID,
      ...(process.env.LOVABLE_API_KEY ? { LOVABLE_API_KEY: process.env.LOVABLE_API_KEY } : {}),
    },
  }],
};