# LedgerMind backend (server + worker share this image; command selects the role).
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

EXPOSE 4000

# Default role: API server. The worker/seed services override `command` in compose.
CMD ["npm", "run", "start"]
