async function updateStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('API down');
    const data = await res.json();

    // 1. Overall status
    const overall = document.getElementById('overall-status');
    const label = overall.querySelector('.label');
    if (data.hbbs && data.hbbr) {
      overall.className = 'status-badge online';
      label.textContent = 'Server Online';
    } else {
      overall.className = 'status-badge offline';
      label.textContent = 'Degraded State';
    }

    // 2. Services control
    const statusHbbs = document.getElementById('status-hbbs');
    statusHbbs.textContent = data.hbbs ? 'Active' : 'Inactive';
    statusHbbs.className = `badge ${data.hbbs ? 'active' : 'inactive'}`;

    const statusHbbr = document.getElementById('status-hbbr');
    statusHbbr.textContent = data.hbbr ? 'Active' : 'Inactive';
    statusHbbr.className = `badge ${data.hbbr ? 'active' : 'inactive'}`;

    // 3. Connection details
    const host = window.location.hostname || data.localIp;
    document.getElementById('id-server-input').value = host;
    document.getElementById('relay-server-input').value = host;

    // 4. Public key
    const pkTextarea = document.getElementById('public-key-textarea');
    if (data.publicKey) {
      pkTextarea.value = data.publicKey;
      
      // 5. Config String Generator
      const configStr = `host=${host}\nkey=${data.publicKey}\napi=http://${host}:21114`;
      document.getElementById('config-string-textarea').value = configStr;
    } else {
      pkTextarea.value = 'Key file not found. Restart services or check container directories.';
      document.getElementById('config-string-textarea').value = 'Config not available without security key';
    }

    // 6. Metrics
    document.getElementById('metric-cpu').textContent = `${(data.metrics.cpu * 100).toFixed(0)}%`;
    document.getElementById('fill-cpu').style.width = `${Math.min(data.metrics.cpu * 100, 100)}%`;

    const ramUsedPct = (data.metrics.ram.used / data.metrics.ram.total) * 100 || 0;
    document.getElementById('metric-ram').textContent = `${data.metrics.ram.used} / ${data.metrics.ram.total} MB`;
    document.getElementById('fill-ram').style.width = `${ramUsedPct}%`;

    const diskUsedPct = (data.metrics.disk.used / data.metrics.disk.total) * 100 || 0;
    document.getElementById('metric-disk').textContent = `${data.metrics.disk.used} / ${data.metrics.disk.total} GB`;
    document.getElementById('fill-disk').style.width = `${diskUsedPct}%`;

    document.getElementById('metric-uptime').textContent = data.metrics.uptime;
  } catch (e) {
    console.error('Failed to update stats:', e);
    const overall = document.getElementById('overall-status');
    overall.className = 'status-badge offline';
    overall.querySelector('.label').textContent = 'API Connection Failed';
  }
}

async function copyValue(id) {
  const el = document.getElementById(id);
  el.select();
  el.setSelectionRange(0, 99999);
  
  try {
    await navigator.clipboard.writeText(el.value);
    
    // Animate copy button/state
    let btn;
    if (id === 'id-server-input') btn = document.getElementById('btn-copy-id');
    else if (id === 'relay-server-input') btn = document.getElementById('btn-copy-relay');
    else if (id === 'public-key-textarea') btn = document.getElementById('btn-copy-key');
    else if (id === 'config-string-textarea') btn = document.getElementById('btn-copy-config');

    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    }
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
}

// Update stats on load and every 5 seconds
updateStatus();
setInterval(updateStatus, 5000);
