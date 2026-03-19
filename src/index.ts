import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import express from 'express';
import { AuthManager } from './auth.js';
import { toolHandlers } from './handlers.js';
import { sanitizeError } from './utils.js';

// Silence dotenv to prevent stdout corruption for MCP
process.env.DOTENV_CONFIG_QUIET = 'true';
dotenv.config({ override: true });

const orgUrl = process.env.AZURE_DEVOPS_ORG_URL || '';
const pat = process.env.AZURE_DEVOPS_PAT || '';
const clientId = process.env.AZURE_DEVOPS_CLIENT_ID || '';
const clientSecret = process.env.AZURE_DEVOPS_CLIENT_SECRET || '';
const tenantId = process.env.AZURE_DEVOPS_TENANT_ID || 'common';
const callbackPort = process.env.CALLBACK_PORT ? parseInt(process.env.CALLBACK_PORT) : 3000;
const mcpDebug = process.env.MCP_DEBUG === 'true';

if (!orgUrl && process.env.NODE_ENV !== 'test') {
  console.error('AZURE_DEVOPS_ORG_URL must be set in .env');
  process.exit(1);
}

const authManager = new AuthManager(orgUrl, pat, clientId, clientSecret, tenantId);

// --- Scopes Mapping ---
const TOOL_SCOPES: Record<string, string> = {
  queryWorkItems: 'Work Items (Read)',
  listEpics: 'Work Items (Read)',
  listFeatures: 'Work Items (Read)',
  listUserStories: 'Work Items (Read)',
  listBacklog: 'Work Items (Read)',
  searchWorkItems: 'Work Items (Read)',
  createEpic: 'Work Items (Read/Write)',
  createFeature: 'Work Items (Read/Write)',
  createUserStory: 'Work Items (Read/Write)',
  createBug: 'Work Items (Read/Write)',
  updateWorkItem: 'Work Items (Read/Write)',
  addWorkItemComment: 'Work Items (Read/Write)',
  linkWorkItems: 'Work Items (Read/Write)',
  getWorkItemHierarchy: 'Work Items (Read)',
  listIterations: 'Project and Team (Read)',
  listAreas: 'Project and Team (Read)',
  listWorkItemTypes: 'Project and Team (Read)',
  listRepositories: 'Code (Read)',
  getFileContent: 'Code (Read)',
  searchCode: 'Code (Read)',
  listPullRequests: 'Code (Read)',
  getPRDiff: 'Code (Read)',
  commentOnPR: 'Code (Read/Write)',
  approvePR: 'Code (Read/Write)',
  mergePR: 'Code (Read/Write)',
  createPR: 'Code (Read/Write)',
  listWikis: 'Wiki (Read)',
  getWikiPage: 'Wiki (Read)',
  listTestRuns: 'Test (Read)',
  getTestResults: 'Test (Read)',
  listVariableGroups: 'Build (Read)',
  getVariableGroup: 'Build (Read)',
  updateVariableGroup: 'Build (Read/Write)',
  getPRPolicyEvaluations: 'Code (Read)',
  listWorkItemStates: 'Project and Team (Read)',
  listWorkItemFields: 'Project and Team (Read)',
  triggerPipeline: 'Build (Read/Execute)',
  listPipelines: 'Build (Read)',
  getBuildStatus: 'Build (Read)',
  getPipelineLogs: 'Build (Read)',
  listProjects: 'Project and Team (Read)',
  getCurrentUser: 'Project and Team (Read)',
  listTeams: 'Project and Team (Read)',
  listTeamMembers: 'Project and Team (Read)',
};

export const server = new Server(
  {
    name: 'azure-devops-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'login',
      description: 'Log in to Azure DevOps interactively via your browser.',
      inputSchema: { type: 'object', properties: {} },
    },
    ...Object.keys(toolHandlers).map(name => ({
      name,
      description: `Azure DevOps tool: ${name}`, // You could improve these descriptions
      inputSchema: { type: 'object', properties: {} }, // Handlers will parse their own schemas
    }))
  ],
}));

// We'll actually want to preserve the detailed descriptions from the original file
// I'll re-add them for better LLM experience.
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'login',
      description: 'Log in to Azure DevOps interactively via your browser.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'queryWorkItems',
      description: 'Run a WIQL query or fetch work items by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'WIQL query string.' },
          ids: { type: 'array', items: { type: 'number' }, description: 'List of work item IDs.' },
          project: { type: 'string', description: 'Azure DevOps project name.' },
          top: { type: 'number', description: 'Limit results (default 50).' },
        },
      },
    },
    {
      name: 'listRepositories',
      description: 'List all repositories in an Azure DevOps project.',
      inputSchema: {
        type: 'object',
        properties: { project: { type: 'string' } },
      },
    },
    {
      name: 'listEpics',
      description: 'List all Epics in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['project'],
      },
    },
    {
      name: 'listFeatures',
      description: 'List all Features in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['project'],
      },
    },
    {
      name: 'listUserStories',
      description: 'List all User Stories in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['project'],
      },
    },
    {
      name: 'listBacklog',
      description: 'List all work items in the backlog (User Stories and Bugs).',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['project'],
      },
    },
    {
      name: 'searchWorkItems',
      description: 'Search work items by keyword.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          searchText: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['searchText'],
      },
    },
    {
      name: 'updateWorkItem',
      description: 'Update a work item (Epic, Feature, Story, or Bug).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string' },
          reproSteps: { type: 'string' },
          state: { type: 'string' },
          assignedTo: { type: 'string' },
          areaPath: { type: 'string' },
          iterationPath: { type: 'string' },
        },
        required: ['id'],
      },
    },
    {
      name: 'addWorkItemComment',
      description: 'Add a comment to a work item.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          text: { type: 'string' },
        },
        required: ['id', 'text'],
      },
    },
    {
      name: 'linkWorkItems',
      description: 'Link two work items together.',
      inputSchema: {
        type: 'object',
        properties: {
          sourceId: { type: 'number' },
          targetId: { type: 'number' },
          rel: { type: 'string' },
        },
        required: ['sourceId', 'targetId'],
      },
    },
    {
      name: 'listProjects',
      description: 'List all projects in the organization.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'getCurrentUser',
      description: 'Get the currently authenticated user.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'listTeams',
      description: 'List teams in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
        },
        required: ['project'],
      },
    },
    {
      name: 'listTeamMembers',
      description: 'List members of a team.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          teamId: { type: 'string' },
        },
        required: ['project', 'teamId'],
      },
    },
    {
      name: 'listIterations',
      description: 'List all iterations (sprints) for a project.',
      inputSchema: {
        type: 'object',
        properties: { project: { type: 'string' } },
        required: ['project'],
      },
    },
    {
      name: 'listAreas',
      description: 'List all area paths for a project.',
      inputSchema: {
        type: 'object',
        properties: { project: { type: 'string' } },
        required: ['project'],
      },
    },
    {
      name: 'listWorkItemTypes',
      description: 'List all work item types available for a project.',
      inputSchema: {
        type: 'object',
        properties: { project: { type: 'string' } },
        required: ['project'],
      },
    },
    {
      name: 'getFileContent',
      description: 'Read file content from a branch or commit.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          path: { type: 'string' },
          version: { type: 'string' },
          project: { type: 'string' },
        },
        required: ['repositoryId', 'path'],
      },
    },
    {
      name: 'searchCode',
      description: 'Search code across project or organization.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          project: { type: 'string' },
          top: { type: 'number' },
        },
        required: ['query'],
      },
    },
    {
      name: 'createEpic',
      description: 'Create a top-level Epic.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string' },
          areaPath: { type: 'string' },
          project: { type: 'string' },
        },
        required: ['title', 'project'],
      },
    },
    {
      name: 'createFeature',
      description: 'Create a Feature linked to an Epic.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          parentEpicId: { type: 'number' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string' },
          areaPath: { type: 'string' },
          project: { type: 'string' },
        },
        required: ['title', 'parentEpicId', 'project'],
      },
    },
    {
      name: 'createUserStory',
      description: 'Create a User Story linked to a Feature.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          parentFeatureId: { type: 'number' },
          description: { type: 'string' },
          acceptanceCriteria: { type: 'string' },
          areaPath: { type: 'string' },
          project: { type: 'string' },
        },
        required: ['title', 'parentFeatureId', 'project'],
      },
    },
    {
      name: 'createBug',
      description: 'Create a Bug work item.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          reproSteps: { type: 'string' },
          project: { type: 'string' },
        },
        required: ['title', 'reproSteps', 'project'],
      },
    },
    {
      name: 'getWorkItemHierarchy',
      description: 'Retrieve parent/child relations.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'number' } },
        required: ['id'],
      },
    },
    {
      name: 'listPullRequests',
      description: 'List active or completed Pull Requests.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          project: { type: 'string' },
          status: { type: 'number' },
          top: { type: 'number' },
        },
        required: ['repositoryId'],
      },
    },
    {
      name: 'getPRDiff',
      description: 'Fetch the code diff for a Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          pullRequestId: { type: 'number' },
        },
        required: ['repositoryId', 'pullRequestId'],
      },
    },
    {
      name: 'commentOnPR',
      description: 'Post a comment on a Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          pullRequestId: { type: 'number' },
          content: { type: 'string' },
        },
        required: ['repositoryId', 'pullRequestId', 'content'],
      },
    },
    {
      name: 'approvePR',
      description: 'Approve or vote on a Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          pullRequestId: { type: 'number' },
          project: { type: 'string' },
          vote: { type: 'number', description: '10 = Approved, 5 = Approved with suggestions, 0 = No vote, -5 = Waiting for author, -10 = Rejected' },
        },
        required: ['repositoryId', 'pullRequestId'],
      },
    },
    {
      name: 'mergePR',
      description: 'Merge (complete) a Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          pullRequestId: { type: 'number' },
          project: { type: 'string' },
          commitMessage: { type: 'string' },
          deleteSourceBranch: { type: 'boolean', default: true },
          mergeStrategy: { type: 'number', description: '0 = NoFastForward, 1 = Squash, 2 = Rebase, 3 = RebaseMerge' },
        },
        required: ['repositoryId', 'pullRequestId'],
      },
    },
    {
      name: 'createPR',
      description: 'Create a new Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string' },
          project: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          sourceRefName: { type: 'string', description: 'e.g. refs/heads/feature-branch' },
          targetRefName: { type: 'string', description: 'e.g. refs/heads/main' },
          isDraft: { type: 'boolean', default: false },
        },
        required: ['repositoryId', 'title', 'sourceRefName'],
      },
    },
    {
      name: 'listWikis',
      description: 'List all wikis in a project or organization.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
        },
      },
    },
    {
      name: 'getWikiPage',
      description: 'Get the content of a wiki page.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          wikiIdentifier: { type: 'string' },
          path: { type: 'string', description: 'The path of the wiki page.' },
        },
        required: ['project', 'wikiIdentifier'],
      },
    },
    {
      name: 'listTestRuns',
      description: 'List test runs in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          top: { type: 'number', default: 50 },
        },
        required: ['project'],
      },
    },
    {
      name: 'getTestResults',
      description: 'Get test results for a specific test run.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          runId: { type: 'number' },
          top: { type: 'number', default: 50 },
        },
        required: ['project', 'runId'],
      },
    },
    {
      name: 'listVariableGroups',
      description: 'List variable groups in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          groupName: { type: 'string' },
          top: { type: 'number', default: 50 },
        },
        required: ['project'],
      },
    },
    {
      name: 'getVariableGroup',
      description: 'Get a specific variable group.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          groupId: { type: 'number' },
        },
        required: ['project', 'groupId'],
      },
    },
    {
      name: 'updateVariableGroup',
      description: 'Update a variable group.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          groupId: { type: 'number' },
          name: { type: 'string' },
          description: { type: 'string' },
          variables: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                value: { type: 'string' },
                isSecret: { type: 'boolean' },
              },
            },
          },
        },
        required: ['project', 'groupId'],
      },
    },
    {
      name: 'getPRPolicyEvaluations',
      description: 'Get policy evaluations for a Pull Request.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
          artifactId: { type: 'string', description: 'e.g. vstfs:///CodeReview/PullRequestId/123' },
          includeNotApplicable: { type: 'boolean', default: false },
        },
        required: ['project', 'artifactId'],
      },
    },
    {
      name: 'listWorkItemStates',
      description: 'List valid states for a work item type in a process.',
      inputSchema: {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          witRefName: { type: 'string', description: 'e.g. Microsoft.VSTS.WorkItemTypes.Bug' },
        },
        required: ['processId', 'witRefName'],
      },
    },
    {
      name: 'listWorkItemFields',
      description: 'List all fields for a work item type in a process.',
      inputSchema: {
        type: 'object',
        properties: {
          processId: { type: 'string' },
          witRefName: { type: 'string' },
        },
        required: ['processId', 'witRefName'],
      },
    },
    {
      name: 'triggerPipeline',
      description: 'Run an Azure DevOps Pipeline.',
      inputSchema: {
        type: 'object',
        properties: {
          pipelineId: { type: 'number' },
          project: { type: 'string' },
        },
        required: ['pipelineId', 'project'],
      },
    },
    {
      name: 'listPipelines',
      description: 'List all pipeline definitions in a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string' },
        },
        required: ['project'],
      },
    },
    {
      name: 'getBuildStatus',
      description: 'Get the status of a specific build.',
      inputSchema: {
        type: 'object',
        properties: {
          buildId: { type: 'number' },
          project: { type: 'string' },
        },
        required: ['buildId', 'project'],
      },
    },
    {
      name: 'getPipelineLogs',
      description: 'Fetch build logs for a pipeline.',
      inputSchema: {
        type: 'object',
        properties: {
          buildId: { type: 'number' },
          project: { type: 'string' },
        },
        required: ['buildId', 'project'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args } = request.params;
  
  if (mcpDebug) {
    console.error(`[DEBUG] Call Tool: ${name}`, JSON.stringify(args, null, 2));
  }

  try {
    if (name === 'login') {
      if (pat) {
        return {
          content: [{
            type: 'text',
            text: 'You are already authenticated using a Personal Access Token (PAT). You do not need to use the "login" tool.'
          }]
        };
      }

      const pca = authManager.getMSALClient();
      if (!pca) throw new Error('OAuth login requires CLIENT_ID and CLIENT_SECRET.');

      const redirectUri = `http://localhost:${callbackPort}/callback`;
      const authUrl = await pca.getAuthCodeUrl({
        scopes: ['499b84ac-1321-427f-aa17-267ca6975798/user_impersonation'],
        redirectUri,
      });

      return new Promise((resolve) => {
        const app = express();
        const serverHttp = app.listen(callbackPort, '127.0.0.1', () => {
          console.error(`Temporary auth server listening on 127.0.0.1:${callbackPort}`);
        });

        app.get('/callback', async (req, res) => {
          const { code } = req.query;
          if (!code) {
            res.send('Authorization failed.');
            serverHttp.close();
            resolve({ isError: true, content: [{ type: 'text', text: 'Auth failed: No code.' }] });
            return;
          }

          try {
            const tokenResponse = await pca.acquireTokenByCode({
              code: code as string,
              scopes: ['499b84ac-1321-427f-aa17-267ca6975798/user_impersonation'],
              redirectUri,
            });

            if (tokenResponse) {
              authManager.saveTokenCache(tokenResponse.accessToken, tokenResponse.expiresOn);
              res.send('Authorization successful! You can close this window.');
              serverHttp.close();
              resolve({ content: [{ type: 'text', text: 'Login successful! Token cached.' }] });
            }
          } catch (error) {
            res.status(500).send('Authentication failed.');
            serverHttp.close();
            resolve({ isError: true, content: [{ type: 'text', text: `Auth failed: ${error}` }] });
          }
        });

        resolve({
          content: [
            { type: 'text', text: `Visit: ${authUrl}` },
            { type: 'text', text: 'Waiting for browser authorization...' }
          ]
        });
      });
    }

    const handler = toolHandlers[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }

    const conn = await authManager.getConnection();
    const result = await handler(conn, args, authManager.getOrgUrl());
    
    if (mcpDebug) {
      console.error(`[DEBUG] Response for ${name}:`, JSON.stringify(result, null, 2));
    }
    return result;

  } catch (error: any) {
    const sanitized = sanitizeError(error, name, TOOL_SCOPES);
    if (mcpDebug) {
      console.error(`[DEBUG] Error in ${name}:`, sanitized);
    }
    return { isError: true, content: [{ type: 'text', text: `Error: ${sanitized}` }] };
  }
});

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Azure DevOps MCP server running');
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
