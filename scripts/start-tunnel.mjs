// Start Expo for a phone on MOBILE DATA without ngrok (this network blocks ngrok, so `expo start --tunnel` fails).
// Opens a Cloudflare quick tunnel to the Metro bundler (port 8081) and starts Expo with
// EXPO_PACKAGER_PROXY_URL set to it, so the QR code / exp:// link points at the public URL.
//   npm run start:tunnel
// The API tunnel (port 2069) is separate: scripts/api-tunnel.cmd, and its URL goes into .env.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const CF = ['C:/Program Files (x86)/cloudflared/cloudflared.exe', 'C:/Program Files/cloudflared/cloudflared.exe', 'cloudflared'].find(p => p === 'cloudflared' || existsSync(p));
const port = 8081;
const cf = spawn(CF, ['tunnel', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
let url = '';
const onData = d => {
  const s = d.toString();
  const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !url) {
    url = m[0];
    console.log(`\nMetro tunnel: ${url}\n`);
    const expo = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'start', '-c', ...process.argv.slice(2)], {
      stdio: 'inherit', shell: process.platform === 'win32',
      env: { ...process.env, EXPO_PACKAGER_PROXY_URL: url },
    });
    expo.on('exit', code => { cf.kill(); process.exit(code ?? 0); });
  }
  if (/ERR/.test(s)) process.stderr.write(s);
};
cf.stdout.on('data', onData);
cf.stderr.on('data', onData);
cf.on('exit', code => { if (!url) { console.error('cloudflared exited before giving a URL (code ' + code + ').'); process.exit(1); } });
process.on('SIGINT', () => { cf.kill(); process.exit(0); });
