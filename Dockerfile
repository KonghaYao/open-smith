# ============================================
# Stage 1: Build
# ============================================
FROM oven/bun:1.3.9-alpine AS builder

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN bun install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build the project
RUN pnpm build

# ============================================
# Stage 2: Runtime
# ============================================
FROM oven/bun:1.3.9-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    # tzdata for timezone support
    tzdata \
    # ca-certificates for HTTPS requests
    ca-certificates

# Copy only the built files and package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/sql ./sql
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml* ./pnpm-lock.yaml*

# Create directories for runtime
RUN mkdir -p /app/attachments /app/sql

# Install dependencies (Bun will use cache if available)
RUN bun install

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=7765

# Expose the default port
EXPOSE 7765

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7765/ || exit 1

# Start the application
CMD ["bun", "dist/index.js"]
