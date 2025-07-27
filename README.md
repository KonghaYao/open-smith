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
