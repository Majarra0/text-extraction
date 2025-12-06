FROM node:20-alpine AS base

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source and build the production bundle
COPY . .
RUN npm run build

# -- Runtime image ----------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173

# Reuse the dependencies that were already installed in the builder stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./

# Copy only what the preview server needs to run
COPY --from=base /app/.svelte-kit ./.svelte-kit
COPY --from=base /app/static ./static
COPY --from=base /app/src ./src
COPY --from=base /app/svelte.config.js ./svelte.config.js
COPY --from=base /app/vite.config.js ./vite.config.js

EXPOSE 4173

# Use SvelteKit's preview server. To change the port, pass -e PORT=<port> at runtime.
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}"]
