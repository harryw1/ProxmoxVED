const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 21114;
const PUBLIC_DIR = path.join(__dirname, 'public');

function getServiceStatus(serviceName) {
  try {
    const status = execSync(`systemctl is-active ${serviceName}`, { encoding: 'utf8' }).trim();
    return status === 'active';
  } catch (e) {
    return false;
  }
}

function getSystemMetrics() {
  const metrics = { cpu: 0, ram: { total: 0, used: 0 }, disk: { total: 0, used: 0 }, uptime: '' };
  try {
    // Uptime
    metrics.uptime = execSync('uptime -p', { encoding: 'utf8' }).trim();

    // CPU load (1 min average)
    const load = fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
    metrics.cpu = parseFloat(load);

    // RAM (in MB)
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalMem = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)[1]) / 1024;
    const freeMem = parseInt(meminfo.match(/MemFree:\s+(\d+)/)[1]) / 1024;
    const buffers = parseInt(meminfo.match(/Buffers:\s+(\d+)/)[1]) / 1024;
    const cached = parseInt(meminfo.match(/Cached:\s+(\d+)/)[1]) / 1024;
    const usedMem = totalMem - freeMem - buffers - cached;
    metrics.ram = {
      total: Math.round(totalMem),
      used: Math.round(usedMem)
    };

    // Disk (in GB)
    const df = execSync("df -m / | tail -n 1 | awk '{print $2,$3}'", { encoding: 'utf8' }).trim().split(' ');
    metrics.disk = {
      total: Math.round(parseInt(df[0]) / 1024),
      used: Math.round(parseInt(df[1]) / 1024)
    };
  } catch (e) {
    console.error('Error fetching metrics:', e);
  }
  return metrics;
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    let publicKey = '';
    try {
      if (fs.existsSync('/opt/rustdesk/id_ed25519.pub')) {
        publicKey = fs.readFileSync('/opt/rustdesk/id_ed25519.pub', 'utf8').trim();
      }
    } catch (e) {
      publicKey = 'Error reading key';
    }

    const data = {
      hbbs: getServiceStatus('rustdesk-hbbs'),
      hbbr: getServiceStatus('rustdesk-hbbr'),
      publicKey: publicKey,
      metrics: getSystemMetrics(),
      localIp: req.headers.host.split(':')[0]
    };
    
    return res.end(JSON.stringify(data));
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  
  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.css':
      contentType = 'text/css';
      break;
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.svg':
      contentType = 'image/svg+xml';
      break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
