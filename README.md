# @langgraph-js/open-smith

`@langgraph-js/open-smith` is an open-source backend for `langgraph-js` that offers LangSmith-compatible tracing and observability for your AI applications. It provides a self-hostable alternative, giving developers full control over their tracing data.

## Features

-   **LangSmith Compatibility**: Designed to work seamlessly with `langgraph-js` to capture traces in a LangSmith-like format.
-   **End-to-End Tracing**: Capture and visualize the entire lifecycle of your AI runs, from user input to final output.
-   **Detailed Run Information**: Log inputs, outputs, events, errors, and metadata for each step of your AI application.
-   **Feedback Mechanism**: Collect and store feedback on individual runs to improve your models and applications.
-   **Attachment Support**: Store relevant files and data associated with specific runs.
-   **System & Thread Tracking**: Organize and filter runs by system and conversation thread for better management and analysis.
-   **Database Agnostic**: Supports both SQLite (for lightweight local development) and PostgreSQL (for production-ready deployments) through a flexible adapter pattern.

## Installation

```sh
pnpm i -D @langgraph-js/open-smith
pnpm open-smith
```

After installation, configure your LangGraph project to use this server by setting the `LANGSMITH_ENDPOINT` environment variable:

```sh
LANGSMITH_ENDPOINT="http://localhost:7765"
LANGSMITH_API_KEY="lsv2_ts" # create key in open-smith
```

GUI Admin URL:

```sh
http://localhost:7765/ui/index.html
```

### Use PG

By default, open-smith uses SQLite to store trace data. You can configure it to use PostgreSQL instead:

To use PostgreSQL, add the following to your `.env` file:

```sh
TRACE_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/open_smith
MASTER_KEY=test-test
```

### Docker Compose

You can run open-smith with TimescaleDB using Docker Compose. Choose the appropriate configuration:

#### Production (Pre-built Image)

Use the pre-built Docker image from GitHub Container Registry:

```yaml
# docker-compose.yml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg17
    container_name: open-smith-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: open_smith
    ports:
      - "5434:5432"
    volumes:
      - timescaledb_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  open-smith:
    image: ghcr.io/konghayao/open-smith:1.0.1
    container_name: open-smith-app
    environment:
      NODE_ENV: production
      PORT: 7765
      TRACE_DATABASE_URL: postgresql://postgres:postgres@timescaledb:5432/open_smith
      MASTER_KEY: ${MASTER_KEY:-change-this-to-a-secure-key}
    ports:
      - "7765:7765"
    volumes:
      - attachments_data:/app/attachments
    depends_on:
      timescaledb:
        condition: service_healthy
    restart: unless-stopped

volumes:
  timescaledb_data:
  attachments_data:
```

**Usage:**

```bash
# Set your master key
export MASTER_KEY=your-secure-master-key

# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

#### Development (Local Build)

To build from source:

```bash
# Clone repository
git clone https://github.com/konghayao/open-smith.git
cd open-smith

# Start services
docker compose up -d
```

**Configuration Options:**

- `MASTER_KEY`: Required. Set your master admin key for system management
- `TRACE_DATABASE_URL`: PostgreSQL connection string. Comment out to use SQLite
- Port mapping: Open Smith defaults to `7765`, TimescaleDB to `5434`

**Access URLs:**

- API: `http://localhost:7765`
- GUI Admin: `http://localhost:7765/ui/index.html`

**Client Configuration:**

Configure your LangGraph/LangChain project:

```sh
LANGSMITH_ENDPOINT="http://localhost:7765"
LANGSMITH_API_KEY="lsv2_ts"  # Create key via Admin GUI
```

