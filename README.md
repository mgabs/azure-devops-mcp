# Azure DevOps MCP Server

A Model Context Protocol (MCP) server that enables LLM agents to interact directly with Azure DevOps services (Boards, Repos, Pipelines). Optimized for context efficiency, security, and developer experience.

## Features

### Core Operations (Boards & Projects)
- **`queryWorkItems`**: Run WIQL queries or fetch specific work items by ID. Optimized with field filtering.
- **`listProjects`**: List all projects in your organization.
- **`listEpics` / `listFeatures` / `listUserStories`**: Quickly discover high-level planning items.
- **`listBacklog`**: View all active User Stories and Bugs in a project.
- **`listIterations` / `listAreas`**: Explore project structure and sprint schedules.
- **`getWorkItemHierarchy`**: Explore parent/child relations for any work item.

### Code & Collaboration (Repos)
- **`listRepositories`**: List all repositories in a project.
- **`getFileContent`**: Read raw file content from any branch or commit.
- **`listPullRequests`**: List active, completed, or abandoned PRs.
- **`getPRDiff`**: Retrieve commits and changes for a specific Pull Request.
- **`commentOnPR`**: Post review feedback or inline comments.
- **`searchCode`**: Placeholder for future organization-wide code search.

### Automation & CI/CD (Pipelines)
- **`triggerPipeline`**: Run builds/pipelines with optional branch and parameters.
- **`getPipelineLogs`**: Fetch build logs for analysis and troubleshooting.

## Security & Sanitization

This server is built with a "Security First" approach to protect your Azure DevOps environment and sensitive data:

- **Secure Token Storage**: Authentication tokens are stored in a platform-specific, secure location in the user's home directory (`~/.mcp/azure-devops-mcp-server/token_cache.json`), preventing accidental exposure in project directories.
- **Sensitive Data Redaction**: The server automatically redacts URLs, Personal Access Tokens (PATs), and Bearer tokens from all error messages, logs, and standard output.
- **Helpful Authorization Guidance**: When access is denied (401/403), the server provides specific advice on which PAT scopes (e.g., `Work Items: Read`) are missing.
- **Context Protection**: A `.geminiignore` file ensures that sensitive workspace data, environment variables, and local caches are never indexed or exposed to the LLM.

## Context Optimization

To minimize token usage and improve LLM performance, this server implements:

- **Field Filtering**: API responses for work items are stripped of redundant metadata, returning only essential fields like Title, State, Type, and AssignedTo.
- **Concise Summaries**: Lists of repositories, projects, and iterations are formatted to provide high-signal information without excessive JSON overhead.

## Setup

### Prerequisites
- Node.js (v18+)
- An Azure DevOps organization URL.
- A Personal Access Token (PAT) with appropriate scopes (e.g., `Work Items: Read/Write`, `Code: Read/Write`, `Build: Read/Write`).

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd devops-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in a `.env` file. Choose one of the following authentication methods:

   **Option A: Personal Access Token (PAT) - Recommended**
   ```env
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/YourOrganization
   AZURE_DEVOPS_PAT=your-personal-access-token
   ```

   **Option B: Interactive OAuth (Interative Login)**
   ```env
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/YourOrganization
   AZURE_DEVOPS_CLIENT_ID=your-client-id
   AZURE_DEVOPS_CLIENT_SECRET=your-client-secret
   CALLBACK_PORT=3000
   ```
   *Action:* Call the `login` tool via your MCP host (e.g., Claude) to receive an authorization link.

4. Build the project:
   ```bash
   npm run build
   ```

## Configuration for MCP Hosts

### Claude Desktop
Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "azure-devops": {
      "command": "node",
      "args": ["/path/to/devops-mcp/dist/index.js"],
      "env": {
        "AZURE_DEVOPS_ORG_URL": "https://dev.azure.com/YourOrganization",
        "AZURE_DEVOPS_PAT": "your-personal-access-token"
      }
    }
  }
}
```

## Project Structure

The project follows a modular architecture for better auditability and maintainability:

- `src/auth.ts`: Manages PAT and OAuth2 authentication, including secure token caching.
- `src/handlers.ts`: Contains the logic for all MCP tool handlers.
- `src/schemas.ts`: Defines Zod schemas for strict input validation.
- `src/utils.ts`: Security redaction and context optimization utilities.
- `src/index.ts`: Main server entry point and tool dispatcher.

## Development

### Running Tests
```bash
npm test
```

### Building
```bash
npm run build
```

## License
ISC
