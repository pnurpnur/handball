FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Copy root package files for prisma
COPY package.json ./
COPY prisma/ ./prisma/

# Copy scraper package
COPY services/scraper/package.json ./services/scraper/
COPY services/scraper/tsconfig.json ./services/scraper/

# Install deps
RUN npm install --workspace=services/scraper

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY services/scraper/src/ ./services/scraper/src/

# Build
WORKDIR /app/services/scraper
RUN npx tsc

EXPOSE 3001

CMD ["node", "dist/index.js"]
