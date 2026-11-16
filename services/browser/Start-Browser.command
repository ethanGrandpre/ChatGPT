#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo 'Install Node.js 22+ from https://nodejs.org/ and run this again.'; read -r -p 'Press Enter to close'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22 or newer is required.");process.exit(1)}'
if [ ! -f .env ]; then
  umask 077
  node --input-type=module -e "import{randomBytes}from'node:crypto';import{writeFileSync}from'node:fs';writeFileSync('.env','ALLOWED_ORIGIN=https://chatgpt.ethan-grandpre0360.workers.dev\\nBROWSER_SERVER_SECRET='+randomBytes(48).toString('hex')+'\\n',{mode:0o600})"
fi
npm ci
npx playwright install chromium
printf '\nKeep this Terminal window open. In another Terminal, run:\ncloudflared tunnel --url http://127.0.0.1:8788\n\nSee README.md to connect the tunnel URL and secret to Cloudflare.\n'
node --env-file=.env server.mjs
