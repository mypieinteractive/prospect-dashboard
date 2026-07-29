# File: Dockerfile
# Version: V1.6
# Changes from previous version:
# - Updated base image from node:20-alpine to node:22-alpine to satisfy engine requirements for npm@latest (v12+).
# - Retained the method of patching the global NPM 'undici' vulnerability.
# - Instead of running 'npm install' inside the npm directory (which threw a 404 error on @npmcli/docs), we now install the patched undici globally and forcefully overwrite NPM's internal vulnerable version using a direct file copy (rm & cp).
# This bypasses the NPM registry validation for NPM's own deep dependencies.

# Use the official, modern Node 22 alpine image
FROM node:22-alpine

# Force Alpine package updates for security patches
RUN apk update && apk upgrade --no-cache

# Update the global npm package manager, download the secure undici package,
# and physically overwrite NPM's internal vulnerable undici folder to satisfy Trivy.
RUN npm install -g npm@latest undici@^6.27.0 && \
    rm -rf /usr/local/lib/node_modules/npm/node_modules/undici && \
    cp -a /usr/local/lib/node_modules/undici /usr/local/lib/node_modules/npm/node_modules/

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
