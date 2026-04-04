FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Copy root package files
COPY package.json ./
COPY prisma/ ./prisma/

# Copy scraper package files
COPY services/scraper/package.json ./services/scraper/
COPY services/scraper/prisma/ ./services/scraper/prisma/
COPY services/scraper/tsconfig.json ./services/scraper/

# Install deps (no postinstall, prisma generate runs explicitly below)
RUN npm install --workspace=services/scraper --ignore-scripts

# Generate Prisma client (schema is at /app/prisma/schema.prisma)
RUN npx prisma generate

# Copy source and build
COPY services/scraper/src/ ./services/scraper/src/

WORKDIR /app/services/scraper
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
