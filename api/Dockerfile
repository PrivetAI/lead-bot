FROM node:18-alpine

WORKDIR /app

# Copy package.json and (if it exists) package-lock.json or npm-shrinkwrap.json
COPY package*.json ./

# Use npm install instead of npm ci so that npm-shrinkwrap.json is honored
RUN npm install --only=production

# Copy application code
COPY src/ ./src/

# Create sessions folder
RUN mkdir -p sessions

EXPOSE 3000
CMD ["npm", "start"]
