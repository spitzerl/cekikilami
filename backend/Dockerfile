FROM docker.io/library/node:22.20.0-alpine@sha256:dbcedd8aeab47fbc0f4dd4bffa55b7c3c729a707875968d467aaaea42d6225af

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 3001
STOPSIGNAL SIGTERM

CMD ["node", "src/server.js"]
