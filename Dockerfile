# ---------- Stage 1: Build Dependencies ----------
FROM node:18-alpine AS builder

# Install ffmpeg & required tools
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Copy package files first
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY . .

# ---------- Stage 2: Final Lightweight Image ----------
FROM node:18-alpine

# Install ffmpeg in final image
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /usr/src/app

# Copy only the built app & node_modules from builder
COPY --from=builder /usr/src/app /usr/src/app

# Use non-root user
USER node

# Run bot
CMD ["node", "index.js"]