FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Run migrations then start the server
CMD ["sh", "-c", "node scripts/migrate.js && node src/server.js"]
