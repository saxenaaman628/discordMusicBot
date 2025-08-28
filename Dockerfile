FROM node:18-alpine
WORKDIR /usr/src/app

# Install minimal dependencies for @discordjs/voice
RUN apk add --no-cache libc6-compat bash ca-certificates

COPY package*.json ./
RUN npm ci --only=production

COPY . .

USER node
CMD ["node", "index.js"]
