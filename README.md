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
- **`listPipelines`**: Discover all pipeline definitions in a project.
- **`getBuildStatus`**: Get the real-time status and result of a specific build.

### Advanced PR & Policy Insights
- **`approvePR`**: Approve or vote on a Pull Request.
- **`mergePR`**: Merge a pull request with support for different strategies (squash, no-fast-forward).
- **`createPR`**: Create a new pull request.
- **`getPRPolicyEvaluations`**: Check the status of all policies (e.g., "Build Validation", "Required Reviewers") blocking a PR.

### Team & Identity Context
- **`getCurrentUser`**: Identify the currently authenticated user.
- **`listTeams`**: Find all teams within a project.
- **`listTeamMembers`**: Retrieve members of a specific team.

### Wiki & Test Results
- **`listWikis`**: Discover all wikis in a project.
- **`getWikiPage`**: Read the content of a specific wiki page.
- **`listTestRuns`**: View a history of test executions.
- **`getTestResults`**: Get detailed results for a test run to diagnose failures.

### DevOps Configuration & Process
- **`listVariableGroups`**, **`getVariableGroup`**, **`updateVariableGroup`**: Manage pipeline configurations and variables.
- **`listWorkItemStates`**, **`listWorkItemFields`**: Discover the specific process and workflow for a project's work items.

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

### Generating a Personal Access Token (PAT)

To use this server with a PAT, follow these steps:

1.  Log in to your Azure DevOps organization (`https://dev.azure.com/YourOrganization`).
2.  In the upper-right corner, click **User settings** (the user icon with a gear) and select **Personal access tokens**.
3.  Click **+ New Token**.
4.  Give your token a name (e.g., `MCP-Server`) and set an expiration date.
5.  Select **Custom defined** for scopes and ensure the following are checked:
    -   **Work Items**: `Read & write` (Required for Boards, Epics, Features, Stories, and Bugs)
    -   **Code**: `Read & write` (Required for Repos, Pull Requests, and file content)
    - **Build**: `Read & execute` (Required for Pipelines and build logs)
        -   **Project and Team**: `Read` (Required for listing projects, iterations, and areas)
        -   **Wiki**: `Read` (Required for reading wiki pages)
        -   **Test Management**: `Read` (Required for listing test runs and results)
        -   **Variable Groups**: `Read & manage` (Required for managing pipeline variables)
        -   **Policy**: `Read` (Required for reading PR policy evaluations)
        -   **Work Item Tracking Process**: `Read` (Required for discovering work item states and fields)
    6.  Click **Create** and **copy the token immediately** (you won't be able to see it again).


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
