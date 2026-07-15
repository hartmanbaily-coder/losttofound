#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -eq 0 ]]; then
  echo "Run scanner recovery as the non-root losttofound user." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_root="${LOSTTOFOUND_APP_ROOT:-$(cd "${script_dir}/../.." && pwd)}"
compose_file="${LOSTTOFOUND_COMPOSE_FILE:-${script_dir}/compose.yml}"
env_file="${LOSTTOFOUND_ENV_FILE:-/srv/losttofound/config/app.env}"
docker_bin="${DOCKER_BIN:-docker}"
container_name="${CLAMAV_CONTAINER_NAME:-losttofound-clamav-1}"
recovery_attempts="${RECOVERY_ATTEMPTS:-30}"
recovery_sleep_seconds="${RECOVERY_SLEEP_SECONDS:-5}"

if [[ ! ${recovery_attempts} =~ ^[1-9][0-9]*$ ]]; then
  echo "RECOVERY_ATTEMPTS must be a positive integer." >&2
  exit 1
fi
if [[ ! ${recovery_sleep_seconds} =~ ^[0-9]+$ ]]; then
  echo "RECOVERY_SLEEP_SECONDS must be a non-negative integer." >&2
  exit 1
fi
if [[ ! -r ${env_file} || ! -r ${compose_file} ]]; then
  echo "Scanner recovery configuration is unavailable." >&2
  exit 1
fi

runtime_uid="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${runtime_uid}}"
export DOCKER_HOST="${DOCKER_HOST:-unix://${XDG_RUNTIME_DIR}/docker.sock}"
export COMPOSE_PROJECT_NAME=losttofound
export LOSTTOFOUND_ENV_FILE="${env_file}"

compose=("${docker_bin}" compose --env-file "${env_file}" -f "${compose_file}")
health="$("${docker_bin}" inspect --format '{{if .State.Running}}{{if .State.Health}}{{.State.Health.Status}}{{else}}running-no-health{{end}}{{else}}stopped{{end}}' "${container_name}" 2>/dev/null || printf 'missing')"

case "${health}" in
  healthy | starting)
    exit 0
    ;;
  unhealthy)
    echo "ClamAV is unhealthy; restarting the scanner."
    "${compose[@]}" restart clamav
    ;;
  missing | stopped)
    echo "ClamAV is ${health}; recreating the scanner."
    "${compose[@]}" up -d clamav
    ;;
  *)
    echo "ClamAV returned unexpected health state '${health}'." >&2
    exit 1
    ;;
esac

for ((attempt = 1; attempt <= recovery_attempts; attempt++)); do
  health="$("${docker_bin}" inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing-healthcheck{{end}}' "${container_name}" 2>/dev/null || printf 'missing')"
  if [[ ${health} == "healthy" ]]; then
    cd "${app_root}"
    "${compose[@]}" exec -T losttofound node scripts/verify-malware-scanner.mjs
    echo "ClamAV recovery and malware verification passed."
    exit 0
  fi
  sleep "${recovery_sleep_seconds}"
done

echo "ClamAV did not recover after ${recovery_attempts} checks." >&2
exit 1
