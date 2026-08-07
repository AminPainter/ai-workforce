# Single image: SearXNG (metasearch) + the NestJS employee-assistant app.
# The SearXNG base is Void Linux / glibc (verified: /usr/lib/ld-linux-*.so, libstdc++.so.6
# already present), so the Node binary is copied from the glibc node:22-slim image — NOT
# node:22-alpine (musl) — and no extra runtime libraries need to be installed.

FROM node:22-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:22-slim AS prod-deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Fetch the Teleport Machine ID agent (tbot). node:22-slim is Debian/glibc, matching
# the searxng runtime base, so the extracted binary runs there without extra libs.
# TELEPORT_VERSION must be >= 18.2.0 (bound-keypair static keys) and match the cluster's
# major version — update this default to the deployed cluster version.
FROM node:22-slim AS tbot
ARG TELEPORT_VERSION=18.7.3
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL "https://cdn.teleport.dev/teleport-v${TELEPORT_VERSION}-linux-amd64-bin.tar.gz" -o /tmp/teleport.tgz \
  && tar -xzf /tmp/teleport.tgz -C /tmp teleport/tbot \
  && /tmp/teleport/tbot version \
  && rm -rf /var/lib/apt/lists/*

FROM searxng/searxng:latest AS runtime
# Bring in a glibc Node binary; all of its shared-lib deps (libc, libstdc++, libgcc_s,
# libm, libdl, libpthread) already exist in the SearXNG base image.
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=tbot /tmp/teleport/tbot /usr/local/bin/tbot
COPY package.json ./
COPY searxng/settings.yml /etc/searxng/settings.yml
COPY docker/tbot.yaml /app/docker/tbot.yaml
COPY docker/start.sh /start.sh
ENTRYPOINT []
CMD ["/start.sh"]
