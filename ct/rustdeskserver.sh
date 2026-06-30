#!/usr/bin/env bash
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVED/main/misc/build.func)
# Copyright (c) 2021-2026 community-scripts ORG
# Author: harryw1
# License: MIT | https://github.com/community-scripts/ProxmoxVED/raw/main/LICENSE
# Source: https://github.com/rustdesk/rustdesk-server

APP="RustDesk Server"
var_tags="${var_tags:-remote-desktop}"
var_cpu="${var_cpu:-1}"
var_ram="${var_ram:-512}"
var_disk="${var_disk:-2}"
var_os="${var_os:-debian}"
var_version="${var_version:-12}"
var_arm64="${var_arm64:-yes}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -f /opt/rustdesk/hbbs ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  if check_for_gh_release "rustdesk" "rustdesk/rustdesk-server"; then
    msg_info "Stopping Services"
    systemctl stop rustdesk-hbbs
    systemctl stop rustdesk-hbbr
    systemctl stop rustdesk-ui
    msg_ok "Stopped Services"

    # Deploy new server binaries
    case "$(dpkg --print-architecture)" in
      amd64) RD_ARCH="amd64" ;;
      arm64) RD_ARCH="arm64v8" ;;
      *) msg_error "Unsupported architecture: $(dpkg --print-architecture)" ; exit ;;
    esac

    fetch_and_deploy_gh_release "rustdesk" "rustdesk/rustdesk-server" "prebuild" "latest" "/opt/rustdesk" "rustdesk-server-linux-${RD_ARCH}.zip"
    mv /opt/rustdesk/amd64/* /opt/rustdesk/ 2>/dev/null || true
    mv /opt/rustdesk/aarch64/* /opt/rustdesk/ 2>/dev/null || true
    chmod +x /opt/rustdesk/hbbs /opt/rustdesk/hbbr

    # Pull latest Web UI Dashboard files
    msg_info "Updating Web UI"
    URL_BASE="https://raw.githubusercontent.com/harryw1/ProxmoxVED/feature/rustdesk-server/rustdesk-ui"
    $STD wget -O /opt/rustdesk-ui/package.json "${URL_BASE}/package.json"
    $STD wget -O /opt/rustdesk-ui/server.js "${URL_BASE}/server.js"
    $STD wget -O /opt/rustdesk-ui/public/index.html "${URL_BASE}/public/index.html"
    $STD wget -O /opt/rustdesk-ui/public/style.css "${URL_BASE}/public/style.css"
    $STD wget -O /opt/rustdesk-ui/public/app.js "${URL_BASE}/public/app.js"
    msg_ok "Updated Web UI"

    msg_info "Starting Services"
    systemctl start rustdesk-hbbs
    systemctl start rustdesk-hbbr
    systemctl start rustdesk-ui
    msg_ok "Started Services"
    msg_ok "Updated successfully!"
  fi
  exit
}

start
build_container
description

msg_ok "Completed successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access it using the following URL:${CL}"
echo -e "${GATEWAY}${BGN}http://${IP}:21114${CL}"
