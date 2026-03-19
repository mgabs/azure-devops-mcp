import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Mock the Azure DevOps Node API
const mockCreatePullRequestReviewer = jest.fn();
const mockUpdatePullRequest = jest.fn();
const mockCreatePullRequest = jest.fn();
const mockGetPullRequest = jest.fn();
const mockGetDefinitions = jest.fn();
const mockGetBuild = jest.fn();
const mockGetTeams = jest.fn();
const mockGetTeamMembersWithExtendedProperties = jest.fn();
const mockGetAllWikis = jest.fn();
const mockGetPageText = jest.fn();
const mockGetTestRuns = jest.fn();
const mockGetTestResults = jest.fn();
const mockGetVariableGroups = jest.fn();
const mockGetVariableGroup = jest.fn();
const mockUpdateVariableGroup = jest.fn();
const mockGetPolicyEvaluations = jest.fn();
const mockGetStateDefinitions = jest.fn();
const mockGetAllWorkItemTypeFields = jest.fn();
const mockQueryByWiql = jest.fn();
const mockGetWorkItems = jest.fn();
const mockConnect = jest.fn();

jest.mock('azure-devops-node-api', () => ({
  getPersonalAccessTokenHandler: jest.fn(),
  getBearerHandler: jest.fn(),
  getBearerTokenHandler: jest.fn(),
  WebApi: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    getWorkItemTrackingApi: jest.fn().mockResolvedValue({
      queryByWiql: mockQueryByWiql,
      getWorkItems: mockGetWorkItems,
    }),
    getGitApi: jest.fn().mockResolvedValue({
      createPullRequestReviewer: mockCreatePullRequestReviewer,
      updatePullRequest: mockUpdatePullRequest,
      createPullRequest: mockCreatePullRequest,
      getPullRequest: mockGetPullRequest,
    }),
    getBuildApi: jest.fn().mockResolvedValue({
      getDefinitions: mockGetDefinitions,
      getBuild: mockGetBuild,
    }),
    getCoreApi: jest.fn().mockResolvedValue({
      getTeams: mockGetTeams,
      getTeamMembersWithExtendedProperties: mockGetTeamMembersWithExtendedProperties,
    }),
    getWikiApi: jest.fn().mockResolvedValue({
      getAllWikis: mockGetAllWikis,
      getPageText: mockGetPageText,
    }),
    getTestResultsApi: jest.fn().mockResolvedValue({
      getTestRuns: mockGetTestRuns,
      getTestResults: mockGetTestResults,
    }),
    getTaskAgentApi: jest.fn().mockResolvedValue({
      getVariableGroups: mockGetVariableGroups,
      getVariableGroup: mockGetVariableGroup,
      updateVariableGroup: mockUpdateVariableGroup,
    }),
    getPolicyApi: jest.fn().mockResolvedValue({
      getPolicyEvaluations: mockGetPolicyEvaluations,
    }),
    getWorkItemTrackingProcessApi: jest.fn().mockResolvedValue({
      getStateDefinitions: mockGetStateDefinitions,
      getAllWorkItemTypeFields: mockGetAllWorkItemTypeFields,
    }),
  })),
}));

describe('Azure DevOps MCP Server New Tools Tests', () => {
  let listHandler: any;
  let callHandler: any;
  let server: any;

  beforeAll(async () => {
    process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/test';
    process.env.AZURE_DEVOPS_PAT = 'test-pat';
    process.env.NODE_ENV = 'test';

    const mod = await import('../src/index.js');
    server = mod.server;

    // @ts-ignore
    listHandler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    // @ts-ignore
    callHandler = server._requestHandlers.get(CallToolRequestSchema.shape.method.value);
  });

  describe('Tool Listing', () => {
    it('should register all new tools', async () => {
      const response = await listHandler({ method: 'tools/list', params: {} });
      const toolNames = response.tools.map((t: any) => t.name);
      
      const newTools = [
        'approvePR', 'mergePR', 'createPR', 'listPipelines', 
        'getBuildStatus', 'getCurrentUser', 'listTeams', 
        'listTeamMembers', 'searchWorkItems'
      ];

      newTools.forEach(tool => {
        expect(toolNames).toContain(tool);
      });
    });
  });

  describe('PR Management', () => {
    it('approvePR should call createPullRequestReviewer', async () => {
      mockConnect.mockResolvedValue({ authenticatedUser: { id: 'user-id', displayName: 'Test User' } });
      mockCreatePullRequestReviewer.mockResolvedValue({ displayName: 'Test User', vote: 10 });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'approvePR',
          arguments: { repositoryId: 'repo-id', pullRequestId: 123, vote: 10 }
        }
      });

      expect(response.content[0].text).toContain('PR 123 voted with 10');
      expect(mockCreatePullRequestReviewer).toHaveBeenCalledWith({ vote: 10 }, 'repo-id', 123, 'user-id', undefined);
    });

    it('mergePR should call updatePullRequest', async () => {
      mockGetPullRequest.mockResolvedValue({ lastMergeSourceCommit: { commitId: 'abc' } });
      mockUpdatePullRequest.mockResolvedValue({ status: 3 });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'mergePR',
          arguments: { repositoryId: 'repo-id', pullRequestId: 123 }
        }
      });

      expect(response.content[0].text).toContain('PR 123 merged (completed) successfully');
      expect(mockUpdatePullRequest).toHaveBeenCalled();
    });

    it('createPR should call createPullRequest', async () => {
      mockCreatePullRequest.mockResolvedValue({ pullRequestId: 456, title: 'New PR' });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'createPR',
          arguments: { repositoryId: 'repo-id', title: 'New PR', sourceRefName: 'refs/heads/feature' }
        }
      });

      expect(response.content[0].text).toContain('PR created: 456 - New PR');
      expect(mockCreatePullRequest).toHaveBeenCalledWith(expect.objectContaining({ title: 'New PR' }), 'repo-id', undefined);
    });
  });

  describe('Build & Pipeline Management', () => {
    it('listPipelines should call getDefinitions', async () => {
      mockGetDefinitions.mockResolvedValue([{ id: 1, name: 'Build 1', path: '\\' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listPipelines',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Build 1');
      expect(mockGetDefinitions).toHaveBeenCalledWith('TestProject');
    });

    it('getBuildStatus should call getBuild', async () => {
      mockGetBuild.mockResolvedValue({ id: 123, status: 2, result: 1 });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'getBuildStatus',
          arguments: { project: 'TestProject', buildId: 123 }
        }
      });

      expect(response.content[0].text).toContain('"id": 123');
      expect(mockGetBuild).toHaveBeenCalledWith('TestProject', 123);
    });
  });

  describe('Identity & Teams', () => {
    it('getCurrentUser should return authenticated user', async () => {
      mockConnect.mockResolvedValue({ authenticatedUser: { id: 'user-id' } });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'getCurrentUser',
          arguments: {}
        }
      });

      expect(response.content[0].text).toContain('user-id');
    });

    it('listTeams should call getTeams', async () => {
      mockGetTeams.mockResolvedValue([{ name: 'Team 1' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listTeams',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Team 1');
    });
  });

  describe('Discovery', () => {
    it('searchWorkItems should query work items by text', async () => {
      mockQueryByWiql.mockResolvedValue({ workItems: [{ id: 1 }] });
      mockGetWorkItems.mockResolvedValue([{ id: 1, fields: { 'System.Title': 'Search Match' } }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'searchWorkItems',
          arguments: { searchText: 'Match' }
        }
      });

      expect(response.content[0].text).toContain('Search Match');
      expect(mockQueryByWiql).toHaveBeenCalledWith(expect.objectContaining({ query: expect.stringContaining('Match') }), undefined, undefined, 20);
    });
  });

  describe('Wiki Management', () => {
    it('listWikis should call getAllWikis', async () => {
      mockGetAllWikis.mockResolvedValue([{ name: 'Wiki 1' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listWikis',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Wiki 1');
      expect(mockGetAllWikis).toHaveBeenCalledWith('TestProject');
    });

    it('getWikiPage should return page content from stream', async () => {
      const { Readable } = await import('stream');
      const mockStream = Readable.from(['Wiki Page Content']);
      mockGetPageText.mockResolvedValue(mockStream);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'getWikiPage',
          arguments: { project: 'TestProject', wikiIdentifier: 'wiki-id' }
        }
      });

      expect(response.content[0].text).toBe('Wiki Page Content');
    });
  });

  describe('Testing & Quality', () => {
    it('listTestRuns should call getTestRuns', async () => {
      mockGetTestRuns.mockResolvedValue([{ id: 1, name: 'Run 1' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listTestRuns',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Run 1');
    });

    it('getTestResults should call getTestResults', async () => {
      mockGetTestResults.mockResolvedValue([{ testCase: { name: 'Test 1' }, outcome: 'Passed' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'getTestResults',
          arguments: { project: 'TestProject', runId: 123 }
        }
      });

      expect(response.content[0].text).toContain('Test 1');
    });
  });

  describe('Variable Groups', () => {
    it('listVariableGroups should call getVariableGroups', async () => {
      mockGetVariableGroups.mockResolvedValue([{ id: 1, name: 'Group 1' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listVariableGroups',
          arguments: { project: 'TestProject' }
        }
      });

      expect(response.content[0].text).toContain('Group 1');
      expect(mockGetVariableGroups).toHaveBeenCalledWith('TestProject', undefined, undefined, 50);
    });

    it('updateVariableGroup should call updateVariableGroup with merged variables', async () => {
      mockGetVariableGroup.mockResolvedValue({ id: 1, name: 'Group 1', variables: { var1: { value: 'val1' } } });
      mockUpdateVariableGroup.mockResolvedValue({ id: 1 });

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'updateVariableGroup',
          arguments: { project: 'TestProject', groupId: 1, variables: { var2: { value: 'val2' } } }
        }
      });

      expect(response.content[0].text).toContain('Variable group 1 updated successfully.');
      expect(mockUpdateVariableGroup).toHaveBeenCalledWith(expect.objectContaining({
        variables: { var1: { value: 'val1' }, var2: { value: 'val2' } }
      }), 1);
    });
  });

  describe('PR Policy', () => {
    it('getPRPolicyEvaluations should call getPolicyEvaluations', async () => {
      mockGetPolicyEvaluations.mockResolvedValue([{ status: 'succeeded' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'getPRPolicyEvaluations',
          arguments: { project: 'TestProject', artifactId: 'art-id' }
        }
      });

      expect(response.content[0].text).toContain('succeeded');
      expect(mockGetPolicyEvaluations).toHaveBeenCalledWith('TestProject', 'art-id', false);
    });
  });

  describe('Process Discovery', () => {
    it('listWorkItemStates should call getStateDefinitions', async () => {
      mockGetStateDefinitions.mockResolvedValue([{ name: 'Active' }]);

      const response = await callHandler({
        method: 'tools/call',
        params: {
          name: 'listWorkItemStates',
          arguments: { processId: 'proc-id', witRefName: 'wit-id' }
        }
      });

      expect(response.content[0].text).toContain('Active');
      expect(mockGetStateDefinitions).toHaveBeenCalledWith('proc-id', 'wit-id');
    });
  });
});
