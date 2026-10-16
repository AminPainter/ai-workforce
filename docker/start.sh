#!/bin/sh
set -e

# Launch SearXNG via its own entrypoint (config init + Granian on :8080) in the background.
# Run it from /usr/local/searxng so `granian searx.webapp:app` can import the searx package,
# matching the base image's WORKDIR. Entrypoint path verified against searxng/searxng:latest.
(cd /usr/local/searxng && exec ./entrypoint.sh) &

# Teleport Machine ID (tbot): joins via bound-keypair static key and exposes each
# Teleport-fronted app on a local plaintext tunnel (see docker/tbot.yaml). Auto-renews
# short-lived certs in the background. Consumers reach an app via its 127.0.0.1 port.
tbot start -c /app/docker/tbot.yaml &
tbot_pid=$!

# Don't accept traffic until every tunnel is listening, so a worker's first call to a
# Teleport-fronted app doesn't race Teleport startup. Ports are derived from tbot.yaml, so
# adding a tunnel there needs no change here. Dependency-free LISTEN check via /proc/net/tcp
# (127.0.0.1 -> local_address 0100007F:<port-hex>, rem 00000000:0000, state 0A).
tunnel_ports=$(grep -vE '^[[:space:]]*#' /app/docker/tbot.yaml | grep -oE 'listen: *tcp://127\.0\.0\.1:[0-9]+' | grep -oE '[0-9]+$')

wait_for_tunnel() {
  listen="0100007F:$(printf '%04X' "$1") 00000000:0000 0A"
  i=0
  until grep -q "$listen" /proc/net/tcp; do
    if ! kill -0 "$tbot_pid" 2>/dev/null; then
      echo "tbot exited before the tunnel on 127.0.0.1:$1 came up" >&2
      exit 1
    fi
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "timed out waiting for Teleport tunnel on 127.0.0.1:$1" >&2
      exit 1
    fi
    sleep 1
  done
  echo "Teleport tunnel up on 127.0.0.1:$1"
}

for port in $tunnel_ports; do
  wait_for_tunnel "$port"
done

# The app binds Render's $PORT on 0.0.0.0 and reaches SearXNG on 127.0.0.1:8080.
exec node /app/dist/main
