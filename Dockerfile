FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY healthcheck.js ./
RUN npm ci
COPY . .
RUN npm run build

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

CMD ["node", "dist/main.js"]