import * as azdev from 'azure-devops-node-api';
import { Operation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import type { JsonPatchOperation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import { TreeStructureGroup } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import * as schemas from './schemas.js';
import { formatWorkItem, formatWorkItemList } from './utils.js';

export type ToolHandler = (conn: azdev.WebApi, args: any, orgUrl: string) => Promise<any>;

export const toolHandlers: Record<string, ToolHandler> = {
  listProjects: async (conn) => {
    const coreApi = await conn.getCoreApi();
    const projects = await coreApi.getProjects();
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  },

  listIterations: async (conn, args) => {
    const { project } = schemas.ListMetadataSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    try {
      const workApi = await conn.getWorkApi();
      const iterations = await workApi.getTeamIterations({ project });
      if (iterations && iterations.length > 0) {
        return { content: [{ type: 'text', text: JSON.stringify(iterations, null, 2) }] };
      }
    } catch (e) {
      // Fallback
    }
    const nodes = await witApi.getClassificationNode(project, TreeStructureGroup.Iterations, undefined, 5);
    return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
  },

  listAreas: async (conn, args) => {
    const { project } = schemas.ListMetadataSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const nodes = await witApi.getClassificationNode(project, TreeStructureGroup.Areas, undefined, 5);
    return { content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }] };
  },

  listWorkItemTypes: async (conn, args) => {
    const { project } = schemas.ListMetadataSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const types = await witApi.getWorkItemTypes(project);
    return { content: [{ type: 'text', text: JSON.stringify(types, null, 2) }] };
  },

  addWorkItemComment: async (conn, args) => {
    const { id, text } = schemas.AddCommentSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const wi = await witApi.getWorkItem(id, ['System.TeamProject']);
    const project = wi.fields?.['System.TeamProject'];
    if (!project) throw new Error(`Could not find project for work item ${id}`);
    await witApi.addComment({ text }, project, id);
    return { content: [{ type: 'text', text: `Comment added to work item ${id}.` }] };
  },

  linkWorkItems: async (conn, args, orgUrl) => {
    const { sourceId, targetId, rel } = schemas.LinkWorkItemsSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const targetUrl = `${orgUrl}/_apis/wit/workItems/${targetId}`;
    const patch: JsonPatchOperation[] = [{
      op: Operation.Add,
      path: '/relations/-',
      value: { rel, url: targetUrl }
    }];
    await witApi.updateWorkItem(null, patch, sourceId);
    return { content: [{ type: 'text', text: `Linked ${sourceId} to ${targetId} with relationship ${rel}.` }] };
  },

  queryWorkItems: async (conn, args) => {
    const { query, ids, project, top } = schemas.QueryWorkItemsSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const fields = ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo', 'System.TeamProject'];
    
    if (ids) {
      const workItems = await witApi.getWorkItems(ids, fields);
      return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
    } else if (query) {
      const result = await witApi.queryByWiql({ query }, project ? { project } : undefined, undefined, top);
      const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
      if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No work items found.' }] };
      const workItems = await witApi.getWorkItems(itemIds, fields);
      return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
    }
    throw new Error('Provide query or ids.');
  },

  listEpics: async (conn, args) => {
    const { project, top } = schemas.ListWorkItemsByTypeSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const query = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'Epic' ORDER BY [System.CreatedDate] DESC`;
    const result = await witApi.queryByWiql({ query }, { project }, undefined, top);
    const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
    if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No Epics found.' }] };
    const workItems = await witApi.getWorkItems(itemIds, ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo']);
    return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
  },

  listFeatures: async (conn, args) => {
    const { project, top } = schemas.ListWorkItemsByTypeSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const query = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'Feature' ORDER BY [System.CreatedDate] DESC`;
    const result = await witApi.queryByWiql({ query }, { project }, undefined, top);
    const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
    if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No Features found.' }] };
    const workItems = await witApi.getWorkItems(itemIds, ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo']);
    return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
  },

  listUserStories: async (conn, args) => {
    const { project, top } = schemas.ListWorkItemsByTypeSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const query = `SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'User Story' ORDER BY [System.CreatedDate] DESC`;
    const result = await witApi.queryByWiql({ query }, { project }, undefined, top);
    const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
    if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No User Stories found.' }] };
    const workItems = await witApi.getWorkItems(itemIds, ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo']);
    return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
  },

  listBacklog: async (conn, args) => {
    const { project, top } = schemas.ListBacklogSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const query = `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] IN ('User Story', 'Bug') AND [System.State] NOT IN ('Done', 'Closed', 'Removed') ORDER BY [System.CreatedDate] DESC`;
    const result = await witApi.queryByWiql({ query }, { project }, undefined, top);
    const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
    if (itemIds.length === 0) return { content: [{ type: 'text', text: 'Backlog is empty.' }] };
    const workItems = await witApi.getWorkItems(itemIds, ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo']);
    return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
  },

  updateWorkItem: async (conn, args) => {
    const { id, title, description, state, assignedTo } = schemas.UpdateWorkItemSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [];
    if (title !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.Title', value: title });
    if (description !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.Description', value: description });
    if (state !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.State', value: state });
    if (assignedTo !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.AssignedTo', value: assignedTo });
    if (patch.length === 0) throw new Error('No updates provided.');
    await witApi.updateWorkItem(null, patch, id);
    return { content: [{ type: 'text', text: `Work item ${id} updated successfully.` }] };
  },

  listRepositories: async (conn, args) => {
    const { project } = schemas.ListRepositoriesSchema.parse(args);
    const gitApi = await conn.getGitApi();
    const repositories = await gitApi.getRepositories(project);
    return { content: [{ type: 'text', text: JSON.stringify(repositories, null, 2) }] };
  },

  getFileContent: async (conn, args) => {
    const { repositoryId, path, version, project } = schemas.GetFileContentSchema.parse(args);
    const gitApi = await conn.getGitApi();
    const item = await gitApi.getItem(repositoryId, path, project, undefined, undefined, undefined, undefined, undefined, version ? { version, versionType: 0 } : undefined, true);
    return { content: [{ type: 'text', text: item.content || 'File content empty.' }] };
  },

  searchCode: async () => {
    return { content: [{ type: 'text', text: 'Search functionality temporarily unavailable. Use listRepositories and getFileContent to explore code.' }] };
  },

  createEpic: async (conn, args, orgUrl) => {
    const { title, description, project } = schemas.CreateEpicSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/fields/System.Description', value: description || '' },
    ];
    const workItem = await witApi.createWorkItem(null, patch, project, 'Epic');
    return { content: [{ type: 'text', text: `Epic created: ${workItem.id}` }] };
  },

  createFeature: async (conn, args, orgUrl) => {
    const { title, parentEpicId, project } = schemas.CreateFeatureSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${orgUrl}/_apis/wit/workItems/${parentEpicId}` } },
    ];
    const workItem = await witApi.createWorkItem(null, patch, project, 'Feature');
    return { content: [{ type: 'text', text: `Feature created: ${workItem.id}` }] };
  },

  createUserStory: async (conn, args, orgUrl) => {
    const { title, parentFeatureId, project } = schemas.CreateUserStorySchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${orgUrl}/_apis/wit/workItems/${parentFeatureId}` } },
    ];
    const workItem = await witApi.createWorkItem(null, patch, project, 'User Story');
    return { content: [{ type: 'text', text: `User Story created: ${workItem.id}` }] };
  },

  createBug: async (conn, args) => {
    const { title, reproSteps, project } = schemas.CreateBugSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: reproSteps },
    ];
    const workItem = await witApi.createWorkItem(null, patch, project, 'Bug');
    return { content: [{ type: 'text', text: `Bug created: ${workItem.id}` }] };
  },

  getWorkItemHierarchy: async (conn, args) => {
    const { id } = schemas.GetHierarchySchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const workItem = await witApi.getWorkItem(id, undefined, undefined, 4);
    return { content: [{ type: 'text', text: JSON.stringify(workItem.relations, null, 2) }] };
  },

  listPullRequests: async (conn, args) => {
    const { repositoryId, project, status, top } = schemas.ListPRsSchema.parse(args);
    const gitApi = await conn.getGitApi();
    const prs = await gitApi.getPullRequests(repositoryId, { status }, project, top);
    return { content: [{ type: 'text', text: JSON.stringify(prs, null, 2) }] };
  },

  getPRDiff: async (conn, args) => {
    const { repositoryId, pullRequestId } = schemas.GetPRDiffSchema.parse(args);
    const gitApi = await conn.getGitApi();
    const commits = await gitApi.getPullRequestCommits(repositoryId, pullRequestId);
    return { content: [{ type: 'text', text: JSON.stringify(commits, null, 2) }] };
  },

  commentOnPR: async (conn, args) => {
    const { repositoryId, pullRequestId, content } = schemas.CommentOnPRSchema.parse(args);
    const gitApi = await conn.getGitApi();
    const thread = { comments: [{ content, commentType: 1 }], status: 1 };
    const result = await gitApi.createThread(thread, repositoryId, pullRequestId);
    return { content: [{ type: 'text', text: `Comment posted: ${result.id}` }] };
  },

  triggerPipeline: async (conn, args) => {
    const { pipelineId, project } = schemas.TriggerPipelineSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const result = await buildApi.queueBuild({ definition: { id: pipelineId } }, project);
    return { content: [{ type: 'text', text: `Pipeline triggered: ${result.id}` }] };
  },

  getPipelineLogs: async (conn, args) => {
    const { buildId, project } = schemas.GetPipelineLogsSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const logs = await buildApi.getBuildLogs(project, buildId);
    return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
  },
};
