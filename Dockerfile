FROM node:20-alpine

WORKDIR /app

# Copy package definition
COPY package*.json ./

# Install production dependencies
RUN npm install --production

# Copy all source code, config, and media assets
COPY . .

# Expose port (if health check web server is used)
ENV PORT=3000
EXPOSE 3000

# Start WhatsApp bot
CMD ["npm", "start"]
