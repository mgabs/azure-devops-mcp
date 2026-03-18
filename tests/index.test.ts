import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { server } from '../src/index';

describe('Azure DevOps MCP Server', () => {
  it('should be defined', () => {
    expect(server).toBeDefined();
  });

  it('should register all Phase 1, 2, and 3 tools', async () => {
    // Access the registered tools by calling the handler for 'tools/list'
    // Since we can't easily use executeRequest (which is for clients), 
    // we can use the internal request mapping if needed, or just mock a request.
    
    // The MCP Server class has a private _requestHandlers Map.
    // For testing, we can simulate a list request if the SDK supports it, 
    // or we can just check the registered tools by calling the handler.
    
    // @ts-ignore - accessing private member for testing purposes
    const handler = server._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    
    if (!handler) {
      throw new Error('ListTools handler not found');
    }

    const response = await handler({
      method: 'tools/list',
      params: {}
    });

    const toolNames = response.tools.map((t: any) => t.name);
    
    // Phase 1
    expect(toolNames).toContain('queryWorkItems');
    expect(toolNames).toContain('listRepositories');
    expect(toolNames).toContain('getFileContent');
    expect(toolNames).toContain('searchCode');
    
    // Phase 2
    expect(toolNames).toContain('createEpic');
    expect(toolNames).toContain('createFeature');
    expect(toolNames).toContain('createUserStory');
    expect(toolNames).toContain('createBug');
    expect(toolNames).toContain('getWorkItemHierarchy');
    
    // Phase 3
    expect(toolNames).toContain('listPullRequests');
    expect(toolNames).toContain('getPRDiff');
    expect(toolNames).toContain('commentOnPR');
    expect(toolNames).toContain('triggerPipeline');
    expect(toolNames).toContain('getPipelineLogs');
  });
});
