FROM node:22-slim

ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates tar && \
    case "${TARGETARCH}" in \
      amd64) TP_ARCH=amd64 ;; \
      arm64) TP_ARCH=arm64 ;; \
      *) echo "unsupported arch: ${TARGETARCH}" >&2; exit 1 ;; \
    esac && \
    cd /tmp && \
    curl -fsSL -O "https://cdn.teleport.dev/teleport-v18.9.2-linux-${TP_ARCH}-bin.tar.gz" && \
    curl -fsSL -O "https://cdn.teleport.dev/teleport-v18.9.2-linux-${TP_ARCH}-bin.tar.gz.sha256" && \
    sha256sum -c "teleport-v18.9.2-linux-${TP_ARCH}-bin.tar.gz.sha256" && \
    tar -xzf "teleport-v18.9.2-linux-${TP_ARCH}-bin.tar.gz" && \
    cp teleport/tbot /usr/local/bin/tbot && \
    cp teleport/tsh /usr/local/bin/tsh && \
    rm -rf /tmp/teleport-v18.9.2-linux-*-bin.tar.gz* /tmp/teleport /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY start.mjs ./

EXPOSE 8080
CMD ["node", "start.mjs"]
