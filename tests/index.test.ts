import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock the Azure DevOps Node API
const mockGetWorkItems = jest.fn();
const mockQueryByWiql = jest.fn();
const mockGetRepositories = jest.fn();
const mockGetItem = jest.fn();
const mockCreateWorkItem = jest.fn();

jest.mock('azure-devops-node-api', () => ({
  getPersonalAccessTokenHandler: jest.fn(),
  getBearerHandler: jest.fn(),
  getBearerTokenHandler: jest.fn(),
  WebApi: jest.fn().mockImplementation(() => ({
    getWorkItemTrackingApi: jest.fn().mockResolvedValue({
      getWorkItems: mockGetWorkItems,
      queryByWiql: mockQueryByWiql,
      createWorkItem: mockCreateWorkItem,
    }),
    getGitApi: jest.fn().mockResolvedValue({
      getRepositories: mockGetRepositories,
      getItem: mockGetItem,
    }),
    getBuildApi: jest.fn().mockResolvedValue({}),
  })),
}));

describe('Azure DevOps MCP Server Integration Tests', () => {
  let listHandler: any;
  let callHandler: any;
  let server: any;

  beforeAll(async () => {
    // Set environment variables BEFORE importing the server
    process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/test';
    process.env.AZURE_DEVOPS_PAT = 'test-pat';
    process.env.NODE_ENV = 'test';

    // Dynamic import to ensure env vars are set
    const mod = await import('../src/index.js');
    server = mod.server;

    // @ts-ignore - accessing private member for testing purposes
    listHandler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    // @ts-ignore
    callHandler = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
  });

  describe('Tool Listing', () => {
    it('should register all expected tools', async () => {
      const response = await listHandler({ method: 'tools/list', params: {} });
      const toolNames = response.tools.map((t: any) => t.name);
      
      const expectedTools = [
        'queryWorkItems', 'listRepositories', 'getFileContent', 'searchCode',
        'createEpic', 'createFeature', 'createUserStory', 'createBug',
        'getWorkItemHierarchy', 'listPullRequests', 'getPRDiff', 'commentOnPR',
        'triggerPipeline', 'getPipelineLogs'
      ];

      expectedTools.forEach(tool => {
        expect(toolNames).toContain(tool);
      });
    });
  });

  describe('Tool Execution (queryWorkItems)', () => {
    it('should fetch work items by ID', async () => {
      mockGetWorkItems.mockResolvedValue([{ id: 1, fields: { 'System.Title': 'Test Item' } }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'queryWorkItems',
          arguments: { ids: [1] }
        }
      });

      expect(response.content[0].text).toContain('Test Item');
      expect(mockGetWorkItems).toHaveBeenCalledWith([1], expect.any(Array));
    });
  });

  describe('Tool Execution (listRepositories)', () => {
    it('should list repositories for a project', async () => {
      mockGetRepositories.mockResolvedValue([{ name: 'Repo1' }, { name: 'Repo2' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listRepositories',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Repo1');
      expect(mockGetRepositories).toHaveBeenCalledWith('TestProject');
    });
  });

  describe('Error Handling and Sanitization', () => {
    it('should redact URLs in error messages', async () => {
      mockGetRepositories.mockRejectedValue(new Error('Failed to fetch from https://dev.azure.com/secret/api'));

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listRepositories',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('[REDACTED_URL]');
    });
  });

  describe('Validation (createEpic)', () => {
    it('should succeed with valid parameters', async () => {
      mockCreateWorkItem.mockResolvedValue({ id: 123 });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'createEpic',
          arguments: { title: 'New Epic', project: 'MyProject' }
        }
      });

      expect(response.content[0].text).toContain('Epic created: 123');
    });
  });
});
