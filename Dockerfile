# syntax=docker/dockerfile:1

# The build output is architecture-neutral static files, so pin the builder to the
# build platform: it runs once natively instead of once per target under emulation.
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder

WORKDIR /app

# Corepack ships with Node 24 but is dropped in 25+, so pin pnpm explicitly.
RUN npm install -g pnpm@11.22.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# gzip_static serves these; the official nginx alpine image has no brotli module.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
    -exec gzip -9 -k {} \;

FROM nginxinc/nginx-unprivileged:1.31.4-alpine

ARG VERSION=1.0.0
ARG REVISION=unknown

LABEL org.opencontainers.image.title="vsrg-visualizer" \
      org.opencontainers.image.description="Auto-play note viewer for verticla scrolling rhythm game charts" \
      org.opencontainers.image.source="https://github.com/vsrg-lab/vsrg-visualizer" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

COPY --from=builder /app/dist /usr/share/nginx/html
# MIT requires the notice to travel with every copy, and this image redistributes a build.
COPY LICENSE /LICENSE
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# Not under conf.d: that directory is globbed as server-level config, and this file
# holds bare add_header directives that would fail to parse there.
COPY docker/security-headers.conf /etc/nginx/security-headers.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ehalthz || exit 1
