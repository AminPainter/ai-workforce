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

FROM searxng/searxng:latest AS runtime
# The SearXNG base is Void Linux (glibc) with xbps, but the image ships no repo index,
# so install git with an explicit repository (-R). git is needed by CodingAgentService
# to clone/branch/push the target repo when opening PRs.
RUN xbps-install -Sy -R https://repo-fastly.voidlinux.org/current git \
    && rm -rf /var/cache/xbps
# Bring in a glibc Node binary; all of its shared-lib deps (libc, libstdc++, libgcc_s,
# libm, libdl, libpthread) already exist in the SearXNG base image.
COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY searxng/settings.yml /etc/searxng/settings.yml
COPY docker/start.sh /start.sh
ENTRYPOINT []
CMD ["/start.sh"]
