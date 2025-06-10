FROM node:18-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    procps \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

# Use the existing node user (UID 1000) instead of creating a new one
# The node:18-slim image already has a 'node' user with UID 1000
RUN usermod -a -G audio,video node

# Create directories and set ownership BEFORE switching to node user
RUN mkdir -p /app/sessions /app/logs /app/public /tmp/chrome-sessions /tmp/wa-sessions && \
    chmod -R 755 /app/sessions /app/logs /app/public && \
    chmod -R 777 /tmp/chrome-sessions /tmp/wa-sessions && \
    chown -R node:node /app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV DISPLAY=:99

# Switch to node user AFTER setting permissions
USER node

EXPOSE 3000
CMD ["/startup.sh"]