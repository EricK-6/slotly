# --- Stage 1: install production dependencies only ---
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Stage 2: minimal runtime image ---
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app

# Package managers aren't needed at runtime; removing them shrinks the attack surface.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Files stay owned by root, so the app user can read but not modify its own code.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY db ./db

# Built-in unprivileged user from the official Node image.
USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "src/server.js"]
