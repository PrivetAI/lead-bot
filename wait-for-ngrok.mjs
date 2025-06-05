const http = require('http');
const { spawn } = require('child_process');

const getNgrokUrl = () => {
  return new Promise((resolve) => {
    const req = http.get('http://ngrok:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const publicUrl = json.tunnels?.[0]?.public_url;
          resolve(publicUrl || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
  });
};

const waitForNgrok = async () => {
  console.log('[n8n] Waiting for ngrok tunnel...');
  let publicUrl = null;
  
  while (!publicUrl) {
    publicUrl = await getNgrokUrl();
    if (!publicUrl) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('[n8n] Ngrok URL:', publicUrl);
  process.env.N8N_WEBHOOK_URL = `${publicUrl}/webhook`;
  
  spawn('n8n', ['start'], {
    stdio: 'inherit',
    env: process.env
  });
};

waitForNgrok();