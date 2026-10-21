# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Set default port
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
