# Test Automation for Hybrid RAG Application

This directory contains automated tests for the RAG (Retrieval Augmented Generation) chat application, focusing on testing the integration between RAG functionalities and UI components.

## Test Structure

- **E2E Tests**: End-to-end tests using Playwright that simulate real user interactions with the application
- **Fixtures**: Test data including sample documents for upload testing
- **Utils**: Helper functions and utilities for test implementation

## Test Categories

1. **Basic Chat Functionality** (`chat-basic.spec.ts`): Tests basic chat interface functionality
2. **Chat Input** (`chat-input.spec.ts`): Focused tests on message input functionality that don't require API responses
3. **Document Upload & RAG** (`rag-document.spec.ts`): Tests document upload, processing, and retrieval
4. **UI Interaction** (`ui-interaction.spec.ts`): Tests for UI navigation and component interaction
5. **Document Retrieval Quality** (`retrieval-quality.spec.ts`): Tests relevance and quality of document retrieval
6. **Settings & Configuration** (`settings.spec.ts`): Tests application settings, especially RAG-related settings
7. **Vector Database Integration** (`vector-database.spec.ts`): Tests integration with vector databases
8. **All Vector Databases** (`all-vector-dbs.spec.ts`): Sequential tests for all vector database types

## Running Tests

Before running tests, install the dependencies:

```bash
# Install dependencies
yarn install

# Generate test fixtures
yarn generate-fixtures
```

To run the tests:

```bash
# Run all tests
yarn test

# Run tests with UI
yarn test:ui

# Run in debug mode
yarn test:debug

# Run specific test file
yarn test chat-input.spec.ts

# Run tests in a specific browser
yarn test --project=chromium

# Run vector database integration tests
yarn test:vector-db

# Run tests for all vector database types sequentially
yarn test:all-dbs
```

## Vector Database Testing

The vector database tests require:

1. Either Docker or Podman installed on your system
   - For Docker: `docker-compose` or Docker CLI with Compose plugin
   - For Podman: `podman-compose` available in your PATH
2. The pcloud-rag directory with docker-compose.yml file

The test framework will automatically detect which container system is available:
- It will first try to use `podman-compose`
- If not available, it will fall back to `docker-compose`
- If that's not available, it will try the Docker CLI compose plugin (`docker compose`)
- If no container management tool is available, it will still run tests against any databases already running

These tests will:
- Start vector database containers using the available container management tool
- Test connecting to each database
- Test document upload and embedding
- Test document retrieval using the RAG functionality
- Stop containers after tests are complete

To run vector database tests:

```bash
# Run tests with the default vector database (Qdrant)
yarn test:vector-db

# Run sequential tests for all vector database types
yarn test:all-dbs
```

You can modify which vector databases are tested by editing the `vectorDbs` array in `vector-database.spec.ts`.

### Running Vector Databases Manually

If you prefer to manage the vector database containers yourself:

```bash
# Using Docker:
cd pcloud-rag
docker-compose up -d qdrant

# Using Podman:
cd pcloud-rag
podman-compose up -d qdrant
```

Then run the tests with:

```bash
yarn test:vector-db
```

The tests will detect the running containers and use them without trying to start new ones.

## API Configuration

The tests are configured to use a local OpenAI API endpoint. By default, they use:

```
API Endpoint: http://localhost:8553/v1
Model: qwen2.5:1.5b
```

If you need to modify these settings, you can update the `configureApiSettings` function in `tests/e2e/utils/test-helpers.ts`.

## Test Dependencies

Some tests require:

1. A running OpenAI service with the deepseek-r1:1.5b model available
2. Playwright system dependencies (install with `sudo npx playwright install-deps`)
3. Docker or Podman for vector database tests

For CI/CD environments, the GitHub Actions workflow is configured to only run tests that don't require an API connection (`chat-input.spec.ts`).

## GitHub Actions Integration

The tests are configured to run in GitHub Actions on pull requests and pushes to main branches. See the workflow configuration in `.github/workflows/e2e-tests.yml`.

## Test Coverage

Current test coverage includes:

- Basic chat interactions
- Message input and display
- Document upload and processing
- RAG query functionality
- Document reference display
- Settings and configuration
- Vector database integrations
  - Qdrant
  - Weaviate
  - Chroma
  - PGVector
  - Milvus

## Adding New Tests

When adding new tests:

1. Follow the existing patterns and naming conventions
2. Use the helper functions in `utils/test-helpers.ts`
3. Create fixtures in the `fixtures` directory as needed
4. Add the new test to the appropriate test category 