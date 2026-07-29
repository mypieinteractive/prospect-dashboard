# File: Dockerfile
# Version: V1.7
# Changes from previous version:
# - Added brace-expansion@^5.0.8 to the global installation list.
# - Added commands to forcefully overwrite NPM's internal, vulnerable brace-expansion package (v5.0.7) to satisfy Trivy security scans.

# Use the official, modern Node 22 alpine image
FROM node:22-alpine

# Force Alpine package updates for security patches
RUN apk update && apk upgrade --no-cache

# Update the global npm package manager, download secure dependency packages,
# and physically overwrite NPM's internal vulnerable folders to satisfy Trivy.
RUN npm install -g npm@latest undici@^6.27.0 brace-expansion@^5.0.8 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    cp -a /usr/local/lib/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/ && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/brace-expansion && \
    cp -a /usr/local/lib/node_modules/brace-expansion /usr/local/lib/node_modules/npm/node_modules/

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy local code to the container image
COPY . ./

# Run the web service on container startup
CMD [ "npm", "start" ]
