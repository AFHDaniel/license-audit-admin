FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./

RUN npm install --omit=dev --ignore-scripts 2>/dev/null; exit 0

EXPOSE 8080

ENV NODE_ENV=production
ENV MONDAY_PROXY_PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "--env-file=.env", "server/mondayProxy.mjs"]
