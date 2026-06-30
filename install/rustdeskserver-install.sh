#!/usr/bin/env bash

# Copyright (c) 2021-2026 community-scripts ORG
# Author: harryw1
# License: MIT | https://github.com/community-scripts/ProxmoxVED/raw/main/LICENSE
# Source: https://github.com/rustdesk/rustdesk-server

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

msg_info "Installing Dependencies"
$STD apt install -y unzip
msg_ok "Installed Dependencies"

# Install Node.js for Web UI
NODE_VERSION="22" setup_nodejs

# Download and Deploy official RustDesk Server
case "$(dpkg --print-architecture)" in
  amd64) RD_ARCH="amd64" ;;
  arm64) RD_ARCH="arm64v8" ;;
  *) msg_error "Unsupported architecture: $(dpkg --print-architecture)" ; exit ;;
esac

fetch_and_deploy_gh_release "rustdesk" "rustdesk/rustdesk-server" "prebuild" "latest" "/opt/rustdesk" "rustdesk-server-linux-${RD_ARCH}.zip"

# Relocate binaries if they are nested in an arch subdirectory
mv /opt/rustdesk/amd64/* /opt/rustdesk/ 2>/dev/null || true
mv /opt/rustdesk/aarch64/* /opt/rustdesk/ 2>/dev/null || true
chmod +x /opt/rustdesk/hbbs /opt/rustdesk/hbbr

# Download Custom Web UI Dashboard
msg_info "Downloading Web UI"
mkdir -p /opt/rustdesk-ui/public
URL_BASE="https://raw.githubusercontent.com/harryw1/ProxmoxVED/feature/rustdesk-server/rustdesk-ui"
$STD wget -O /opt/rustdesk-ui/package.json "${URL_BASE}/package.json"
$STD wget -O /opt/rustdesk-ui/server.js "${URL_BASE}/server.js"
$STD wget -O /opt/rustdesk-ui/public/index.html "${URL_BASE}/public/index.html"
$STD wget -O /opt/rustdesk-ui/public/style.css "${URL_BASE}/public/style.css"
$STD wget -O /opt/rustdesk-ui/public/app.js "${URL_BASE}/public/app.js"
msg_ok "Downloaded Web UI"

# Create Services
msg_info "Creating Services"

cat <<EOF >/etc/systemd/system/rustdesk-hbbs.service
[Unit]
Description=RustDesk ID Server (hbbs)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustdesk
ExecStart=/opt/rustdesk/hbbs -k _
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF >/etc/systemd/system/rustdesk-hbbr.service
[Unit]
Description=RustDesk Relay Server (hbbr)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustdesk
ExecStart=/opt/rustdesk/hbbr -k _
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF >/etc/systemd/system/rustdesk-ui.service
[Unit]
Description=RustDesk Server Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustdesk-ui
ExecStart=/usr/bin/node /opt/rustdesk-ui/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl enable -q --now rustdesk-hbbs
systemctl enable -q --now rustdesk-hbbr
systemctl enable -q --now rustdesk-ui
msg_ok "Created Services"

motd_ssh
customize
cleanup_lxc
