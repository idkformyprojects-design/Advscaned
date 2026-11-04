# Bazaar API — zero runtime dependencies, just Node.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/data/bazaar.db UPLOADS_DIR=/data/uploads
COPY server ./server
# Persist /data (SQLite database + uploaded photos) on a volume.
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "--no-warnings", "server/index.js"]
