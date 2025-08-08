# Use an official Node image (keeps compatibility with discord.js v14+)
FROM node:18-bullseye-slim

# Install ffmpeg (required for audio streaming) and cleanup apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create app directory and use non-root 'node' user
WORKDIR /usr/src/app
# Copy package manifests first for better layer caching
COPY package*.json ./

# Install dependencies (use npm ci if package-lock.json is present)
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# Copy app source
COPY . .

# Ensure node owns the files
RUN chown -R node:node /usr/src/app
USER node

# Use environment variables for token, channel id and url. Don't hardcode secrets in image.
# The container will run your bot entry file (bot.js)
CMD ["node", "index.js"]
