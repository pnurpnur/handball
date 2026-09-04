FROM node:20-slim

# Prisma's query engine needs OpenSSL, which the slim base image omits.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files (lockfile keeps installs reproducible)
COPY package.json package-lock.json ./
COPY prisma/ ./prisma/

# Copy scraper package files
COPY services/scraper/package.json ./services/scraper/
COPY services/scraper/tsconfig.json ./services/scraper/

# Install deps (no postinstall, prisma generate runs explicitly below)
RUN npm install --workspace=services/scraper --ignore-scripts

# Generate Prisma client (schema is at /app/prisma/schema.prisma)
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy source and build
COPY services/scraper/src/ ./services/scraper/src/

WORKDIR /app/services/scraper
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
