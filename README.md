# Azure DevOps MCP Server

A Model Context Protocol (MCP) server that enables LLM agents to interact directly with Azure DevOps services (Boards, Repos, Pipelines).

## Features

### Phase 1: Foundations
- **`queryWorkItems`**: Run WIQL queries or fetch specific work items by ID.
- **`listRepositories`**: List all repositories in a project.
- **`getFileContent`**: Read raw file content from any branch or commit.
- **`searchCode`**: Perform full-text code searches across the organization.

### Phase 2: Hierarchical Planning
- **`createEpic`**: Create top-level Epics.
- **`createFeature`**: Create Features and link them to parent Epics.
- **`createUserStory`**: Create User Stories and link them to parent Features.
- **`createBug`**: Create Bug work items with repro steps and severity.
- **`getWorkItemHierarchy`**: Explore parent/child relations for any work item.

### Phase 3: DevOps Automation
- **`listPullRequests`**: List active, completed, or abandoned PRs.
- **`getPRDiff`**: Retrieve code changes for a specific Pull Request.
- **`commentOnPR`**: Post review feedback or inline comments.
- **`triggerPipeline`**: Run builds/pipelines with optional branch and parameters.
- **`getPipelineLogs`**: Fetch build logs for analysis and troubleshooting.

## Setup

### Prerequisites
- Node.js (v18+)
- An Azure DevOps account and Organization URL.
- A Personal Access Token (PAT) with appropriate scopes (`Work Items: Read/Write`, `Code: Read/Write`, `Build: Read/Write`).

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

3. Configure environment variables in a `.env` file. You can choose one of the following authentication methods:

   **Option A: Interactive Login (Recommended for Users)**
   *Requires a Client ID and Secret with "Web" redirect URI set to `http://localhost:3000/callback`.*
   ```env
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/YourOrganization
   AZURE_DEVOPS_CLIENT_ID=your-client-id
   AZURE_DEVOPS_CLIENT_SECRET=your-client-secret
   CALLBACK_PORT=3000
   ```
   *Action:* Call the `login` tool via your MCP host (e.g., Claude) to get a login link.

   **Option B: PAT (Recommended for quick local use)**
   ```env
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/YourOrganization
   AZURE_DEVOPS_PAT=your-personal-access-token
   ```

   **Option C: Service Principal (System-to-System)**
   ```env
   AZURE_DEVOPS_ORG_URL=https://dev.azure.com/YourOrganization
   AZURE_DEVOPS_CLIENT_ID=your-client-id
   AZURE_DEVOPS_CLIENT_SECRET=your-client-secret
   AZURE_DEVOPS_TENANT_ID=your-tenant-id
   ```

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

## Development

### Running Tests
```bash
npm test
```

### Building
```bash
npm run build
```

## Security
- **PAT Scoping:** Always use a PAT with the minimum required permissions.
- **Environment Variables:** Never commit your `.env` file or hardcode secrets.
- **Confirmation:** Destructive actions (like PR merging or work item deletion, if implemented) should be confirmed by the user in the host UI.

## License
ISC
