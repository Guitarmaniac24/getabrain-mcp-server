# Dockerfile for the GetABrain MCP server.
#
# Purpose: lets Glama (and any container host) START the server and speak MCP
# over stdio to introspect its tool list. Tool LISTING is fully static — the
# GetABrain API client is only touched when a tool is actually CALLED — so
# introspection needs no real credentials. The placeholder GETABRAIN_* vars
# below exist only so the startup validation in src/client.ts doesn't throw
# before the stdio transport connects. End users supply real keys at runtime
# (docker run -e GETABRAIN_API_KEY=... -e GETABRAIN_API_SECRET=...).

# ---- build stage: install all deps (incl. tsup) and compile TS -> dist ----
FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm install && npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

# Placeholder credentials so the server boots for introspection. These are NOT
# secrets and grant no access; real calls fail without genuine keys, which
# users pass at runtime.
ENV GETABRAIN_API_KEY=placeholder-for-introspection \
    GETABRAIN_API_SECRET=placeholder-for-introspection

# The MCP server communicates over stdio.
CMD ["node", "dist/index.js"]
