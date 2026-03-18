# PRD: Azure DevOps MCP Server

## 1. Product Overview
The **Azure DevOps MCP Server** is a specialized Model Context Protocol (MCP) implementation that enables LLM agents to interact directly with Azure DevOps services (Boards, Repos, Pipelines). It acts as a "bridge" between the AI host (e.g., Claude Desktop, IDEs) and the Azure DevOps REST API, providing a set of structured tools for project management, code collaboration, and CI/CD automation.

## 2. Target Audience
- **Developers:** Using AI to automate PR reviews, update tasks, or research codebases.
- **DevOps Engineers:** Using agents to monitor pipeline health and troubleshoot build failures.
- **Project Managers:** Using AI to query work items, generate reports, and update project status.

## 3. Key Features & Tools

### Phase 1: Core Foundation (Basic Operations)
| Tool Name | Service | Description | Input Parameters |
| :--- | :--- | :--- | :--- |
| `queryWorkItems` | Boards | Run a WIQL query or fetch by ID. | `query` (WIQL string) or `ids` (list) |
| `updateWorkItem` | Boards | Update status, assigned to, or comments. | `id`, `updates` (JSON patch) |
| `listRepositories` | Repos | List all repos in a project. | `project` |
| `getFileContent` | Repos | Read file content from a branch. | `repo`, `path`, `version` |
| `searchCode` | Repos | Search code within a repository. | `query`, `repo` |

### Phase 2: Hierarchical Planning (Epics, Features & Stories)
| Tool Name | Service | Description | Input Parameters |
| :--- | :--- | :--- | :--- |
| `createEpic` | Boards | Create a top-level Epic. | `title`, `description`, `areaPath` |
| `createFeature` | Boards | Create a Feature and link to a parent Epic. | `title`, `parentEpicId`, `description` |
| `createUserStory` | Boards | Create a User Story and link to a parent Feature. | `title`, `parentFeatureId`, `description` |
| `createBug` | Boards | Create a Bug report. | `title`, `reproSteps`, `severity` |
| `getWorkItemHierarchy` | Boards | Fetch children or parents of a work item. | `id` |

### Phase 3: DevOps Automation (Collaboration & CI/CD)
| Tool Name | Service | Description | Input Parameters |
| :--- | :--- | :--- | :--- |
| `listPullRequests` | Repos | List active PRs. | `repo`, `status` |
| `getPRDiff` | Repos | Fetch the code diff for a PR. | `repo`, `pullRequestId` |
| `commentOnPR` | Repos | Add a review comment or general comment. | `pullRequestId`, `content`, `fileName`, `line` |
| `triggerPipeline` | Pipelines| Run a specific build or release. | `pipelineId`, `branch`, `parameters` |
| `getPipelineLogs` | Pipelines| Fetch logs from a failed build for analysis. | `buildId`, `stepId` |

## 4. Technical Architecture
- **Transport:** Standard Input/Output (stdio) for local use; SSE (Server-Sent Events) for remote deployments.
- **Runtime:** Node.js (TypeScript) using the official `@modelcontextprotocol/sdk`.
- **API Client:** Azure DevOps Node SDK (`azure-devops-node-api`).
- **Validation:** Zod for strict input schema validation.

## 5. Security & Authentication
- **Authentication:** Initially support **Personal Access Tokens (PAT)** via environment variables. Plan for **Microsoft Entra ID OAuth** for enterprise use.
- **Least Privilege:** Documentation must guide users to create PATs with scoped access (e.g., `Work Items: Read/Write`, `Code: Read/Write`).
- **Destructive Actions:** Tools like `deleteWorkItem` or `mergePR` must include a `destructiveHint` to trigger host-side user confirmation.
- **Data Privacy:** Ensure no sensitive information (keys, tokens) is logged to `stderr`.

## 6. User Workflow (Example)
1. **User:** "Check if there are any high-priority bugs in the current sprint."
2. **LLM:** Calls `queryWorkItems` with a WIQL query for `Priority = 1` and `State = 'To Do'`.
3. **LLM:** "There is one bug: 'Login fails on Safari'. Should I assign it to you?"
4. **User:** "Yes, and create a branch for the fix."
5. **LLM:** Calls `updateWorkItem` (assignee) and then a (future) Git tool to branch.

## 7. Success Metrics
- **Latency:** Tool execution (API roundtrip) < 2 seconds.
- **Reliability:** >99% success rate for valid schema inputs.
- **Adoption:** Successful integration with Claude Desktop and at least one major IDE (Cursor/VS Code).

## 8. Roadmap
- **v0.1:** Foundations (Query work items, list repos, fetch code).
- **v0.2:** Hierarchical Planning (Epics, Features, Stories with parent/child linking).
- **v0.3:** DevOps Automation (PR management, CI/CD pipeline triggering and log analysis).
- **v1.0:** Enterprise Features (Wiki, Artifacts, and OAuth support).
