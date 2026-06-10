FROM node:22-bookworm-slim

WORKDIR /app

# Install native build deps for better-sqlite3 and sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /data

ENV DATA_DIR=/data
ENV PORT=7000
ENV NODE_ENV=production

EXPOSE 7000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:7000/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
