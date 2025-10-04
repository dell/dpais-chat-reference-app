<!-- PROJECT LOGO -->
<br />
<h3 align="center">Dell Validated Designs for AI PCs<br /><strong>Dell Pro AI Studio Chat</strong></h3>

<p>
    Dell <a href="https://www.dell.com/en-us/lp/dt/workloads-validated-designs">Validated Designs</a> for AI PCs 
    are open-source reference guides that streamline development of AI applications meant to run on Dell AI PCs with Dell Pro AI Studio. 
    <br /><br />
    This project showcases a Progressive Web App (PWA) chat interface with advanced RAG (Retrieval Augmented Generation) capabilities. This application supports both local document management and remote vector database integration for enterprise-level document retrieval.
</p>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#features">Features</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#project-installation">Project Installation</a></li>
      </ul>
    </li>
    <li><a href="#running-the-application">Running the Application</a></li>
    <li><a href="#optional-vector-database-support">Vector Database Support</a></li>
    <li>
      <a href="#getting-started-with-backend-apis">Getting Started with Backend API</a>
      <ul>
        <li><a href="#1-start-the-api-server">Start the API Server</a></li>
        <li><a href="#2-load-sample-data">Load Sample Data</a></li>
        <li><a href="#3-verify-api-access">Verify API Access</a></li>
      </ul>
    </li>
    <li><a href="#testing-vector-database-integration">Testing Vector Database Integration</a></li>
    <li><a href="#testing-with-podman-containers">Testing with Podman Containers</a></li>
    <li><a href="#running-tests">Running Tests</a></li>
    <li><a href="#initial-configuration">Initial Configuration</a></li>
    <li>
      <a href="#development">Development</a>
      <ul>
        <li><a href="#running-the-development-server">Running the Development Server</a></li>
        <li><a href="#building-for-production">Building for Production</a></li>
        <li><a href="#publishing">Publishing</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#basic-chat">Basic Chat</a></li>
        <li><a href="#local-document-rag">Local Document RAG</a></li>
        <li><a href="#company-documents-rag">Company Documents RAG</a></li>
      </ul>
    </li>
    <li>
      <a href="#configuration">Configuration</a>
      <ul>
        <li><a href="#api-configuration">API Configuration</a></li>
        <li><a href="#vector-database-setup">Vector Database Setup</a></li>
      </ul>
    </li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
    <li><a href="#dependencies">Dependencies</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## Features

- 🤖 Chat interface for conversational AI interactions
- 📄 Local document management for personal RAG
- 🌐 Company Documents integration with remote vector databases
- 💾 Persistent chat history with IndexedDB
- 📝 Support for multiple document formats (PDF, text, etc.)
- 📱 Progressive Web App (PWA) for offline and mobile use
- 🎨 Customizable themes and appearance

## Live Demo
- https://chat.dellproaistudio.com

> 📝 *Dell Pro AI Studio Core, a Text Generation Large Language Model, and a Text Embeddings model is **required** be installed before accessing the live demo. See [Installing Dell Pro AI Studio](#installing-dell-pro-ai-studio) for more information.*
## Getting Started

### Prerequisites

Before installing the project, you'll need to set up your development environment:

For Dell Pro AI Studio, you may either install dependencies, the Dell AI Framework, and require models manually or by using the Dell Pro AI Studio Command Line Interface (`dpais` CLI) for easier setup.

#### Option 1: Install Dell Pro AI Studio using the `dpais` CLI.

*Refer to the [installation guide](https://dell.github.io/dell-pro-ai-studio/cli#getting-started-installation-and-initial-setup) for full details on installation and usage.*

```bash
# Install dpais CLI
winget install Dell.DPAIS

# Install Dell Pro AI Studio dependencies, Dell AI Framework, and select and install initial models
dpais init

# Dell Pro AI Studio Chat requires at least a text embeddings model and a text generation to be installed.
```

#### Option 2: Install Dell Pro AI Studio manually

Before using Dell Pro AI Studio models, ensure you have the following prerequisites installed:

1. **Required Runtimes**
   - [Microsoft .NET Desktop Runtime 8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
   - [Microsoft ASP.NET Core Runtime 8.0](https://dotnet.microsoft.com/download/dotnet/8.0)

2. **Dell Pro AI Studio Core**
   
   Choose the appropriate version for your system:
   
   | Architecture | Download Link |
   |--------------|--------------|
   | ARM64 | [Download Core ARM64](https://dellupdater.dell.com/DellProAIStudio/download/core/arm64/latest) |
   | x64 | [Download Core x64](https://dellupdater.dell.com/DellProAIStudio/download/core/x64/latest) |

3. **Recommended Models**

   Download these starter models to begin using Dell Pro AI Studio from Dell Enterprise Hub: [dell.huggingface.co](https://dell.huggingface.co)
   | Model Type | Dell Enterprise Hub Model |
   |------------|------------|
   | Text Generation | [Dell Enterprise Hub: Microsoft Phi-3.5 Mini Instruct](https://dell.huggingface.co/authenticated/models/microsoft/Phi-3.5-mini-instruct) |
   | Text Generation | [Dell Enterprise Hub: IBM Granite 4.0 H Small](https://dell.huggingface.co/authenticated/models/ibm-granite/granite-4.0-h-small) |
   | Text Generation | [Dell Enterprise Hub: IBM Granite 4.0 H Tiny](https://dell.huggingface.co/authenticated/models/ibm-granite/granite-4.0-h-tiny) |
   | Text Embeddings* | [Dell Enterprise Hub: Nomic Embed Text v1.5](https://dell.huggingface.co/authenticated/models/nomic-ai/nomic-embed-text-v1.5) |

   *Required for Document Chat

> 📝 For detailed installation instructions, please refer to the [Dell Pro AI Studio Core Installation Guide](https://www.dell.com/dell-pro-ai-studio/non_intune_guide)

#### Installing NVM (Node Version Manager)

##### Linux/macOS
```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Add these lines to your ~/.bashrc, ~/.zshrc, ~/.profile, or ~/.bash_profile
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Reload your shell configuration
source ~/.bashrc  # or source ~/.zshrc, etc.

# Verify NVM installation
nvm --version
```

##### Windows
1. Download the NVM for Windows installer from: https://github.com/coreybutler/nvm-windows/releases
2. Run the installer (nvm-setup.exe)
3. Open a new Command Prompt or PowerShell window
4. Verify installation:
```cmd
nvm version
```

#### Installing Node.js

```bash
# Install Node.js 22 (LTS)
nvm install 22

# Use Node.js 22
nvm use 22

# Verify installation
node --version
npm --version
```

#### Installing Yarn

```bash
# Install Yarn globally
npm install -g yarn

# Verify installation
yarn --version
```

#### Installing Podman Compose (for **optional** backend services)

The backend uses Podman Compose to manage containerized services like PostgreSQL with pgvector.

##### Linux/macOS
```bash
# Install Podman
# For Ubuntu/Debian
sudo apt-get install -y podman podman-compose

# For Fedora
sudo dnf install -y podman


# Verify installation
podman --version
podman-compose --version
```

##### Windows
Follow the instructions at https://podman.io/getting-started/installation#windows to install Podman Desktop, which includes Podman Compose.

### Project Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dpais-chat-template-pwa.git
cd dpais-chat-template-pwa

# Install dependencies
yarn install

# Create a .env file from the template
cp .env.example .env

# Configure your environment variables in .env
```

## Running the Application

You can run both the frontend and backend services using a single command:

```bash
# Start both backend (with podman-compose) and frontend
yarn start

# Start only the frontend
yarn dev

# Start only the backend
yarn backend:start

# Stop the backend services
yarn backend:stop

# View backend logs
yarn backend:logs

# Restart the backend services
yarn backend:restart
```
## _(Optional)_ Vector Database Support

The application currently supports connecting to PostgreSQL with pgvector extension for vector search operations:

- **PGVector**: Full integration with PostgreSQL's vector extension for document similarity search
- **Additional databases**: Support for other vector databases (Milvus, Qdrant, Weaviate, Chroma, Pinecone) is planned for future releases

For detailed information about the backend API, see the [Backend API README](backend/README.md).

## Getting Started with Backend API

The backend provides a REST API for vector database operations. Follow these steps to set up and use the backend:

### 1. Start the API Server

```bash
# Start both frontend and backend services
yarn start

# Alternatively, start only the backend
yarn backend:start
```

### 2. Load Sample Data

The backend includes scripts to load sample data into the PGVector database using a local python venv:

```bash
# start the backend if it is not already started
yarn backend:start

# setup local venv (only need to run this once)
yarn backend:setup-venv

# Clear existing data and load NASA Apollo mission transcripts
yarn backend:load-data

# Or load only the mission data
yarn backend:load-missions

# To clear the database without loading new data
yarn backend:clear-data
```

For more details about loading data, see the [Data Loading Scripts README](backend/scripts/README.md).

### 3. Verify API Access

Once the backend is running, you can access:
- API documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### Running Backend Tests

```bash
# Run all backend tests
yarn backend:test

# Run only backend unit tests
yarn backend:test:unit

# Run only backend integration tests
yarn backend:test:integration
```

### Using the Mock Server

For development without containers, you can use the mock server:

```bash
yarn backend:mock
```

The mock server provides the same API endpoints but uses in-memory data instead of actual vector databases.

## Testing Vector Database Integration

You can test the vector database integration with:

```bash
# Test the UI and client-side integration without requiring databases
yarn test:db-data

# Test data loader functionality (file structure and config)
yarn test:data-loader

# Run all UI and structure tests 
yarn test:all
```

These tests verify:
- UI components for database configuration
- RAG query functionality with sample questions
- Data loader structure and configuration
- Vector database configuration detection

The tests are resilient to varying environments and will generate helpful diagnostics even when databases aren't available.

**Note** we are using docker and podman interchangeably here, but is tested using podman in the implementation.

## Testing with Podman Containers

The application includes comprehensive Podman integration tests that verify the entire stack functions correctly with real vector databases:

```bash
# Run the Podman integration test script (interactive)
yarn test:docker

# Run Podman integration tests directly
yarn test:docker-integration

# Environment variables:
# AUTO_START=1            # Automatically start containers without prompting
# SKIP_CONTAINER_CHECK=1  # Skip container availability check
# DEBUG=1                 # Enable verbose debugging output

# Examples:
AUTO_START=1 yarn test:docker  # Start containers automatically and run tests
```

The Podman integration tests verify:
1. Podman container status for all databases
2. Data loader execution and success
3. Database connections and query capabilities
4. End-to-end RAG functionality with the sample data

These tests generate detailed logs and screenshots in the `test-results` directory that you can use for diagnostics.

## Running Tests

The application includes comprehensive test suites for both frontend and backend:

```bash
# Frontend tests (Playwright)
yarn test

# Backend tests (Python pytest)
yarn backend:test

# Backend unit tests only
yarn backend:test:unit

# Backend integration tests
yarn backend:test:integration

# Frontend with Docker integration tests
yarn test:docker-integration
```

## Initial Configuration

After installation, you'll need to configure the default settings in the application:

1. Start the development server:
```bash
yarn dev
```

2. Open the application in your browser (http://localhost:5173)

3. Click on the Settings icon in the sidebar

4. Configure the following settings:

   #### Default Embeddings Model
   - Select your preferred embeddings model (e.g., OpenAI's text-embedding-3-small)
   - This model will be used for all document embeddings

   #### Default LLM Models
   - Set your primary LLM model (e.g., Phi3.5-mini-instruct, Qwen2.5:1.5b)
   - Configure fallback models if needed
   - Set model parameters (temperature, max tokens, etc.)

   #### DPAIS Configuration
   - Enter your DPAIS URL (e.g., https://api.dpais.com/v1)
   - Test the connection to verify it works

5. Save all settings

> Note: These settings can be changed later through the Settings dialog. The configuration is persisted in your browser's local storage.

## Development

### Running the Development Server

```bash
# Start the development server
yarn dev

# The application will be available at http://localhost:5173
```

### Building for Production

```bash
# Build the application
yarn build

# Preview the production build locally
yarn preview
```

### Publishing

To deploy the application:

1. Build the application:
```bash
yarn build
```

2. The production build will be available in the `dist` directory

3. Deploy the contents of the `dist` directory to your hosting service

## Usage

### Basic Chat

1. Start a new chat session
2. Enter your query in the input box
3. Wait for the AI assistant's response

### Local Document RAG

1. Navigate to the Documents tab in the sidebar
2. Upload documents you want to use for RAG
3. Select a document or tag to include in the current chat session
4. Ask questions related to your documents

### Company Documents RAG

1. Navigate to the Company tab in the sidebar
2. Set up vector database connections in Settings
3. Search across configured vector databases
4. Add vector database sources to your chat for context-aware answers

## Configuration

### API Configuration

Configure your LLM API settings in the Settings dialog:

1. API Base URL for Dell Pro AI Studio
2. API Key: Authentication key for the service
3. Embeddings Model: Model to use for document embeddings

### Vector Database Setup

1. Go to Settings > Vector Databases
2. Click "Add Vector Database"
3. Select the database type and fill in connection details
4. Test the connection to verify it works
5. Save the configuration

You can add multiple instances of each vector database type and combine them in your RAG workflow.

## Troubleshooting

### Common Issues

1. **Node.js Version Issues**
   - Ensure you're using Node.js 22: `nvm use 22`
   - Clear npm cache: `npm cache clean --force`

2. **Dependency Issues**
   - Delete node_modules and yarn.lock: `rm -rf node_modules yarn.lock`
   - Reinstall dependencies: `yarn install`

3. **Environment Variables**
   - Ensure all required environment variables are set in `.env`
   - Restart the development server after updating `.env`

## Dependencies

- React with TypeScript
- Material UI for interface components
- LangChain for RAG workflow integration
- RxDB for local database management
- Various vector database client libraries

## License

[Apache License 2.0](LICENSE)


<h3 align="center">
    <a href="https://dell.com/ai">Learn more about Dell AI Solutions and the Dell AI Factory »</a>
</h3>
