#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this bootstrap script as root on a fresh Ubuntu host." >&2
  exit 1
fi

if [[ ! -r /etc/os-release ]]; then
  echo "Cannot identify the operating system." >&2
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release
if [[ ${ID:-} != "ubuntu" ]]; then
  echo "This bootstrap is supported only on Ubuntu." >&2
  exit 1
fi

runtime_user="losttofound"
runtime_home="/home/${runtime_user}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y \
  apparmor \
  ca-certificates \
  curl \
  dbus-user-session \
  fail2ban \
  gnupg \
  jq \
  rsync \
  systemd-oomd \
  uidmap \
  ufw \
  unattended-upgrades

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

architecture="$(dpkg --print-architecture)"
codename="${UBUNTU_CODENAME:-${VERSION_CODENAME}}"
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${codename}
Components: stable
Architectures: ${architecture}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y \
  containerd.io \
  docker-buildx-plugin \
  docker-ce \
  docker-ce-cli \
  docker-ce-rootless-extras \
  docker-compose-plugin

systemctl disable --now docker.service docker.socket || true

if ! id "${runtime_user}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${runtime_user}"
fi

install -d -m 0700 -o "${runtime_user}" -g "${runtime_user}" "${runtime_home}/.ssh"
if [[ -s /root/.ssh/authorized_keys ]]; then
  install -m 0600 -o "${runtime_user}" -g "${runtime_user}" \
    /root/.ssh/authorized_keys "${runtime_home}/.ssh/authorized_keys"
fi
if [[ ! -s "${runtime_home}/.ssh/authorized_keys" ]]; then
  echo "No SSH public key is available for ${runtime_user}; refusing to disable root login." >&2
  exit 1
fi

runtime_uid="$(id -u "${runtime_user}")"
systemctl start "user@${runtime_uid}.service"
loginctl enable-linger "${runtime_user}"

runuser -u "${runtime_user}" -- env \
  HOME="${runtime_home}" \
  XDG_RUNTIME_DIR="/run/user/${runtime_uid}" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${runtime_uid}/bus" \
  dockerd-rootless-setuptool.sh install --force

install -d -m 0700 -o "${runtime_user}" -g "${runtime_user}" \
  "${runtime_home}/.config/docker"
cat >"${runtime_home}/.config/docker/daemon.json" <<'EOF'
{
  "log-driver": "local",
  "no-new-privileges": true
}
EOF
chown "${runtime_user}:${runtime_user}" "${runtime_home}/.config/docker/daemon.json"
chmod 0600 "${runtime_home}/.config/docker/daemon.json"

runuser -u "${runtime_user}" -- env \
  HOME="${runtime_home}" \
  XDG_RUNTIME_DIR="/run/user/${runtime_uid}" \
  DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/${runtime_uid}/bus" \
  systemctl --user restart docker.service

cat >/etc/sysctl.d/90-losttofound-hardening.conf <<'EOF'
net.ipv4.ip_unprivileged_port_start=80
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
kernel.unprivileged_bpf_disabled=1
fs.protected_fifos=2
fs.protected_regular=2
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
EOF
sysctl --system

install -d -m 0750 -o "${runtime_user}" -g "${runtime_user}" \
  /srv/losttofound /srv/losttofound/app /srv/losttofound/config /srv/losttofound/state
if [[ ! -e /srv/losttofound/config/app.env ]]; then
  install -m 0600 -o "${runtime_user}" -g "${runtime_user}" /dev/null \
    /srv/losttofound/config/app.env
fi

cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 4
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

cat >/etc/ssh/sshd_config.d/99-losttofound-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers ${runtime_user}
EOF
sshd -t
systemctl restart ssh

dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now unattended-upgrades.service
systemctl enable --now systemd-oomd.service || true

runuser -u "${runtime_user}" -- env \
  HOME="${runtime_home}" \
  XDG_RUNTIME_DIR="/run/user/${runtime_uid}" \
  DOCKER_HOST="unix:///run/user/${runtime_uid}/docker.sock" \
  docker info

echo "Host bootstrap complete. Confirm a new SSH login as ${runtime_user} before closing this root session."
