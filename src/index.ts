import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as azdev from 'azure-devops-node-api';
import { JsonPatchOperation, Operation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import { PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import * as msal from '@azure/msal-node';
import * as dotenv from 'dotenv';
import { z } from 'zod';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const AZURE_DEVOPS_ORG_URL = process.env.AZURE_DEVOPS_ORG_URL || '';
const AZURE_DEVOPS_PAT = process.env.AZURE_DEVOPS_PAT || '';
const AZURE_DEVOPS_CLIENT_ID = process.env.AZURE_DEVOPS_CLIENT_ID || '';
const AZURE_DEVOPS_CLIENT_SECRET = process.env.AZURE_DEVOPS_CLIENT_SECRET || '';
const AZURE_DEVOPS_TENANT_ID = process.env.AZURE_DEVOPS_TENANT_ID || 'common';
const CALLBACK_PORT = process.env.CALLBACK_PORT ? parseInt(process.env.CALLBACK_PORT) : 3000;
const TOKEN_CACHE_PATH = path.join(process.cwd(), '.mcp_token_cache.json');

if (!AZURE_DEVOPS_ORG_URL) {
  console.error('AZURE_DEVOPS_ORG_URL must be set in .env');
  process.exit(1);
}

// Authentication Setup
let connection: azdev.WebApi | null = null;
let tokenExpiry: number | null = null;
let userAccessToken: string | null = null;
let pcaInstance: msal.ConfidentialClientApplication | null = null;

// Load existing token from cache if it exists
if (fs.existsSync(TOKEN_CACHE_PATH)) {
  try {
    const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf-8'));
    userAccessToken = cache.accessToken;
    tokenExpiry = cache.expiresOn ? new Date(cache.expiresOn).getTime() : null;
  } catch (e) {
    console.error('Failed to load token cache:', e);
  }
}

function getMSALClient() {
  if (pcaInstance) return pcaInstance;
  if (!AZURE_DEVOPS_CLIENT_ID || !AZURE_DEVOPS_CLIENT_SECRET) return null;
  
  const msalConfig = {
    auth: {
      clientId: AZURE_DEVOPS_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${AZURE_DEVOPS_TENANT_ID}`,
      clientSecret: AZURE_DEVOPS_CLIENT_SECRET,
    },
  };
  pcaInstance = new msal.ConfidentialClientApplication(msalConfig);
  return pcaInstance;
}

async function getConnection(): Promise<azdev.WebApi> {
  const now = Date.now();
  
  // 1. Prioritize User Access Token (from login tool)
  if (userAccessToken && tokenExpiry && now < (tokenExpiry - 300000)) {
    if (connection) return connection;
    const authHandler = azdev.getBearerTokenHandler(userAccessToken);
    connection = new azdev.WebApi(AZURE_DEVOPS_ORG_URL, authHandler);
    return connection;
  }

  // 2. Fallback to PAT
  if (AZURE_DEVOPS_PAT) {
    if (connection) return connection;
    const authHandler = azdev.getPersonalAccessTokenHandler(AZURE_DEVOPS_PAT);
    connection = new azdev.WebApi(AZURE_DEVOPS_ORG_URL, authHandler);
    return connection;
  } 
  
  // 3. Fallback to Service Principal (OAuth Client Credentials)
  const pca = getMSALClient();
  if (pca) {
    const tokenResponse = await pca.acquireTokenByClientCredential({
      scopes: ['499b84ac-1321-427f-aa17-267ca6975798/.default'],
    });

    if (!tokenResponse?.accessToken) {
      throw new Error('Failed to acquire OAuth token.');
    }

    tokenExpiry = tokenResponse.expiresOn ? tokenResponse.expiresOn.getTime() : now + 3600000;
    const authHandler = azdev.getBearerTokenHandler(tokenResponse.accessToken);
    connection = new azdev.WebApi(AZURE_DEVOPS_ORG_URL, authHandler);
    return connection;
  }

  throw new Error('No authentication method configured. Please run the "login" tool or set AZURE_DEVOPS_PAT.');
}

function sanitizeError(error: any): string {
  const message = error.message || String(error);
  return message.replace(/https:\/\/[^\s]+/g, '[REDACTED_URL]');
}

export const server = new Server(
  {
    name: 'azure-devops-mcp-server',
    version: '0.2.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// --- Schemas ---
const QueryWorkItemsSchema = z.object({
  query: z.string().optional(),
  ids: z.array(z.number()).optional(),
  project: z.string().optional(),
  top: z.number().optional().default(50),
});

const ListRepositoriesSchema = z.object({
  project: z.string().optional(),
});

const GetFileContentSchema = z.object({
  repositoryId: z.string(),
  path: z.string(),
  version: z.string().optional(),
  project: z.string().optional(),
});

const SearchCodeSchema = z.object({
  query: z.string(),
  project: z.string().optional(),
  top: z.number().optional().default(10),
});

const CreateEpicSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  areaPath: z.string().optional(),
  project: z.string(),
});

const CreateFeatureSchema = z.object({
  title: z.string(),
  parentEpicId: z.number(),
  description: z.string().optional(),
  project: z.string(),
});

const CreateUserStorySchema = z.object({
  title: z.string(),
  parentFeatureId: z.number(),
  description: z.string().optional(),
  project: z.string(),
});

const CreateBugSchema = z.object({
  title: z.string(),
  reproSteps: z.string(),
  severity: z.string().optional(),
  project: z.string(),
});

const GetHierarchySchema = z.object({
  id: z.number(),
});

const ListPRsSchema = z.object({
  repositoryId: z.string(),
  project: z.string().optional(),
  status: z.nativeEnum(PullRequestStatus).optional().default(PullRequestStatus.Active),
  top: z.number().optional().default(20),
});

const GetPRDiffSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  project: z.string().optional(),
});

const CommentOnPRSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  content: z.string(),
  fileName: z.string().optional(),
  line: z.number().optional(),
  project: z.string().optional(),
});

const TriggerPipelineSchema = z.object({
  pipelineId: z.number(),
  project: z.string(),
  branch: z.string().optional(),
  parameters: z.record(z.any()).optional(),
});

const GetPipelineLogsSchema = z.object({
  buildId: z.number(),
  project: z.string(),
});

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
        properties: {
          project: { type: 'string', description: 'Azure DevOps project name.' },
        },
      },
    },
    {
      name: 'getFileContent',
      description: 'Read file content from a branch or commit.',
      inputSchema: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string', description: 'Repository ID or name.' },
          path: { type: 'string', description: 'File path.' },
          version: { type: 'string', description: 'Branch or commit.' },
          project: { type: 'string', description: 'Project name.' },
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
          query: { type: 'string', description: 'Search query.' },
          project: { type: 'string', description: 'Project name.' },
          top: { type: 'number', description: 'Max results.' },
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'login') {
      const pca = getMSALClient();
      if (!pca) throw new Error('OAuth login requires CLIENT_ID and CLIENT_SECRET.');

      const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
      const authUrl = await pca.getAuthCodeUrl({
        scopes: ['499b84ac-1321-427f-aa17-267ca6975798/user_impersonation'],
        redirectUri,
      });

      return new Promise((resolve) => {
        const app = express();
        const serverHttp = app.listen(CALLBACK_PORT, '127.0.0.1', () => {
          console.error(`Temporary auth server listening on 127.0.0.1:${CALLBACK_PORT}`);
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
              userAccessToken = tokenResponse.accessToken;
              tokenExpiry = tokenResponse.expiresOn ? tokenResponse.expiresOn.getTime() : Date.now() + 3600000;
              fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify({ accessToken: userAccessToken, expiresOn: tokenResponse.expiresOn }, null, 2));
              res.send('Authorization successful! You can close this window.');
              serverHttp.close();
              connection = null; // Force reconnection with new token
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

    const conn = await getConnection();
    const witApi = await conn.getWorkItemTrackingApi();
    const gitApi = await conn.getGitApi();
    const buildApi = await conn.getBuildApi();

    switch (name) {
      case 'queryWorkItems': {
        const { query, ids, project, top } = QueryWorkItemsSchema.parse(args);
        // Optimization: Default fields to reduce context usage
        const fields = ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo'];
        if (ids) {
          const workItems = await witApi.getWorkItems(ids, fields);
          return { content: [{ type: 'text', text: JSON.stringify(workItems, null, 2) }] };
        } else if (query) {
          const result = await witApi.queryByWiql({ query }, { project }, top);
          const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
          if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No work items found.' }] };
          const workItems = await witApi.getWorkItems(itemIds, fields);
          return { content: [{ type: 'text', text: JSON.stringify(workItems, null, 2) }] };
        }
        throw new McpError(ErrorCode.InvalidParams, 'Provide query or ids.');
      }

      case 'listRepositories': {
        const { project } = ListRepositoriesSchema.parse(args);
        const repositories = await gitApi.getRepositories(project);
        return { content: [{ type: 'text', text: JSON.stringify(repositories, null, 2) }] };
      }

      case 'getFileContent': {
        const { repositoryId, path, version, project } = GetFileContentSchema.parse(args);
        const item = await gitApi.getItem(repositoryId, path, project, undefined, undefined, undefined, undefined, undefined, version ? { version, versionType: 0 } : undefined, true);
        return { content: [{ type: 'text', text: item.content || 'File content empty.' }] };
      }

      case 'searchCode': {
        const { query, project, top } = SearchCodeSchema.parse(args);
        const searchApi = await conn.getSearchApi();
        const result = await searchApi.fetchCodeSearchResults({ searchText: query, $top: top, filters: project ? { project: [project] } : undefined });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'createEpic': {
        const { title, description, project } = CreateEpicSchema.parse(args);
        const patch: JsonPatchOperation[] = [
          { op: Operation.Add, path: '/fields/System.Title', value: title },
          { op: Operation.Add, path: '/fields/System.Description', value: description || '' },
        ];
        const workItem = await witApi.createWorkItem(null, patch, project, 'Epic');
        return { content: [{ type: 'text', text: `Epic created: ${workItem.id}` }] };
      }

      case 'createFeature': {
        const { title, parentEpicId, project } = CreateFeatureSchema.parse(args);
        const patch: JsonPatchOperation[] = [
          { op: Operation.Add, path: '/fields/System.Title', value: title },
          { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${AZURE_DEVOPS_ORG_URL}/_apis/wit/workItems/${parentEpicId}` } },
        ];
        const workItem = await witApi.createWorkItem(null, patch, project, 'Feature');
        return { content: [{ type: 'text', text: `Feature created: ${workItem.id}` }] };
      }

      case 'createUserStory': {
        const { title, parentFeatureId, project } = CreateUserStorySchema.parse(args);
        const patch: JsonPatchOperation[] = [
          { op: Operation.Add, path: '/fields/System.Title', value: title },
          { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${AZURE_DEVOPS_ORG_URL}/_apis/wit/workItems/${parentFeatureId}` } },
        ];
        const workItem = await witApi.createWorkItem(null, patch, project, 'User Story');
        return { content: [{ type: 'text', text: `User Story created: ${workItem.id}` }] };
      }

      case 'createBug': {
        const { title, reproSteps, project } = CreateBugSchema.parse(args);
        const patch: JsonPatchOperation[] = [
          { op: Operation.Add, path: '/fields/System.Title', value: title },
          { op: Operation.Add, path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: reproSteps },
        ];
        const workItem = await witApi.createWorkItem(null, patch, project, 'Bug');
        return { content: [{ type: 'text', text: `Bug created: ${workItem.id}` }] };
      }

      case 'getWorkItemHierarchy': {
        const { id } = GetHierarchySchema.parse(args);
        const workItem = await witApi.getWorkItem(id, undefined, undefined, 4);
        return { content: [{ type: 'text', text: JSON.stringify(workItem.relations, null, 2) }] };
      }

      case 'listPullRequests': {
        const { repositoryId, project, status, top } = ListPRsSchema.parse(args);
        const prs = await gitApi.getPullRequests(repositoryId, { status }, project, top);
        return { content: [{ type: 'text', text: JSON.stringify(prs, null, 2) }] };
      }

      case 'getPRDiff': {
        const { repositoryId, pullRequestId } = GetPRDiffSchema.parse(args);
        const commits = await gitApi.getPullRequestCommits(repositoryId, pullRequestId);
        return { content: [{ type: 'text', text: JSON.stringify(commits, null, 2) }] };
      }

      case 'commentOnPR': {
        const { repositoryId, pullRequestId, content } = CommentOnPRSchema.parse(args);
        const thread = { comments: [{ content, commentType: 1 }], status: 1 };
        const result = await gitApi.createThread(thread, repositoryId, pullRequestId);
        return { content: [{ type: 'text', text: `Comment posted: ${result.id}` }] };
      }

      case 'triggerPipeline': {
        const { pipelineId, project } = TriggerPipelineSchema.parse(args);
        const result = await buildApi.queueBuild({ definition: { id: pipelineId } }, project);
        return { content: [{ type: 'text', text: `Pipeline triggered: ${result.id}` }] };
      }

      case 'getPipelineLogs': {
        const { buildId, project } = GetPipelineLogsSchema.parse(args);
        const logs = await buildApi.getBuildLogs(project, buildId);
        return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }
  } catch (error: any) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${sanitizeError(error)}` }] };
  }
});

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Azure DevOps MCP server running');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
}
