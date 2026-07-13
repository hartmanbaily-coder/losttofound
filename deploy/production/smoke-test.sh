#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yml"
env_file="${LOSTTOFOUND_ENV_FILE:-/srv/losttofound/config/app.env}"
runtime_uid="$(id -u)"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/${runtime_uid}}"
export DOCKER_HOST="${DOCKER_HOST:-unix://${XDG_RUNTIME_DIR}/docker.sock}"
export COMPOSE_PROJECT_NAME=losttofound
export LOSTTOFOUND_ENV_FILE="${env_file}"

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error http://127.0.0.1:8080/caddy-health >/dev/null && \
    curl --fail --silent --show-error http://127.0.0.1:8080/records >/dev/null; then
    break
  fi
  if [[ ${attempt} -eq 30 ]]; then
    echo "Local Caddy/app health checks did not become ready." >&2
    exit 1
  fi
  sleep 5
done

readiness_status="$(curl --fail --silent --show-error \
  http://127.0.0.1:8080/api/records/readiness | jq -r '.status // ""')"
if [[ ${readiness_status} != "ready" ]]; then
  echo "Readiness API returned status '${readiness_status}'." >&2
  exit 1
fi

login_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"email":"deploy-probe","password":"not-a-real-password","adultConfirmed":true}' \
  http://127.0.0.1:8080/api/records/auth/login)"
if [[ ${login_status} != "400" && ${login_status} != "401" ]]; then
  echo "Login probe returned unexpected HTTP ${login_status}." >&2
  exit 1
fi

docker compose --env-file "${env_file}" -f "${compose_file}" exec -T losttofound \
  node scripts/verify-malware-scanner.mjs
docker compose --env-file "${env_file}" -f "${compose_file}" exec -T losttofound \
  env RECORDS_APP_BASE_URL=http://caddy:8080 ALLOW_INSECURE_HEADER_CHECK=true \
  node scripts/verify-security-headers.mjs

echo "Local deployment smoke checks passed."
