import * as azdev from 'azure-devops-node-api';
import { Operation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import type { JsonPatchOperation } from 'azure-devops-node-api/interfaces/common/VSSInterfaces.js';
import { TreeStructureGroup } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import { PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import * as schemas from './schemas.js';
import { formatWorkItem, formatWorkItemList } from './utils.js';

export type ToolHandler = (conn: azdev.WebApi, args: any, orgUrl: string) => Promise<any>;

export const toolHandlers: Record<string, ToolHandler> = {
  listProjects: async (conn) => {
    const coreApi = await conn.getCoreApi();
    const projects = await coreApi.getProjects();
    return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
  },

  getCurrentUser: async (conn) => {
    const connection = await conn.connect();
    return { content: [{ type: 'text', text: JSON.stringify(connection.authenticatedUser, null, 2) }] };
  },

  listTeams: async (conn, args) => {
    const { project } = schemas.ListTeamsSchema.parse(args);
    const coreApi = await conn.getCoreApi();
    const teams = await coreApi.getTeams(project);
    return { content: [{ type: 'text', text: JSON.stringify(teams, null, 2) }] };
  },

  listTeamMembers: async (conn, args) => {
    const { project, teamId } = schemas.ListTeamMembersSchema.parse(args);
    const coreApi = await conn.getCoreApi();
    const members = await coreApi.getTeamMembersWithExtendedProperties(project, teamId);
    return { content: [{ type: 'text', text: JSON.stringify(members, null, 2) }] };
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
    const { id, title, description, acceptanceCriteria, reproSteps, state, assignedTo, areaPath, iterationPath } = schemas.UpdateWorkItemSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [];
    if (title !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.Title', value: title });
    if (description !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.Description', value: description });
    if (acceptanceCriteria !== undefined) patch.push({ op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: acceptanceCriteria });
    if (reproSteps !== undefined) patch.push({ op: Operation.Add, path: '/fields/Microsoft.VSTS.TCM.ReproSteps', value: reproSteps });
    if (state !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.State', value: state });
    if (assignedTo !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.AssignedTo', value: assignedTo });
    if (areaPath !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.AreaPath', value: areaPath });
    if (iterationPath !== undefined) patch.push({ op: Operation.Add, path: '/fields/System.IterationPath', value: iterationPath });
    if (patch.length === 0) throw new Error('No updates provided.');
    const result = await witApi.updateWorkItem(null, patch, id);
    return { content: [{ type: 'text', text: `Work item ${id} updated successfully.` }] };
    },

    searchWorkItems: async (conn, args) => {
    const { project, searchText, top } = schemas.SearchWorkItemsSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const query = project 
      ? `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.TeamProject] = '${project}' AND ([System.Title] CONTAINS '${searchText}' OR [System.Description] CONTAINS '${searchText}') ORDER BY [System.CreatedDate] DESC`
      : `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State] FROM WorkItems WHERE [System.Title] CONTAINS '${searchText}' OR [System.Description] CONTAINS '${searchText}' ORDER BY [System.CreatedDate] DESC`;

    const result = await witApi.queryByWiql({ query }, undefined, undefined, top);
    const itemIds = result.workItems?.map((wi) => wi.id).filter((id): id is number => id !== undefined) || [];
    if (itemIds.length === 0) return { content: [{ type: 'text', text: 'No work items found matching the search text.' }] };
    const workItems = await witApi.getWorkItems(itemIds, ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo']);
    return { content: [{ type: 'text', text: JSON.stringify(formatWorkItemList(workItems), null, 2) }] };
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
    const { title, description, acceptanceCriteria, areaPath, project } = schemas.CreateEpicSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/fields/System.Description', value: description || '' },
    ];
    if (acceptanceCriteria) patch.push({ op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: acceptanceCriteria });
    if (areaPath) patch.push({ op: Operation.Add, path: '/fields/System.AreaPath', value: areaPath });
    const workItem = await witApi.createWorkItem(null, patch, project, 'Epic');
    return { content: [{ type: 'text', text: `Epic created: ${workItem.id}` }] };
  },

  createFeature: async (conn, args, orgUrl) => {
    const { title, parentEpicId, description, acceptanceCriteria, areaPath, project } = schemas.CreateFeatureSchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/fields/System.Description', value: description || '' },
      { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${orgUrl}/_apis/wit/workItems/${parentEpicId}` } },
    ];
    if (acceptanceCriteria) patch.push({ op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: acceptanceCriteria });
    if (areaPath) patch.push({ op: Operation.Add, path: '/fields/System.AreaPath', value: areaPath });
    const workItem = await witApi.createWorkItem(null, patch, project, 'Feature');
    return { content: [{ type: 'text', text: `Feature created: ${workItem.id}` }] };
  },

  createUserStory: async (conn, args, orgUrl) => {
    const { title, parentFeatureId, description, acceptanceCriteria, areaPath, project } = schemas.CreateUserStorySchema.parse(args);
    const witApi = await conn.getWorkItemTrackingApi();
    const patch: JsonPatchOperation[] = [
      { op: Operation.Add, path: '/fields/System.Title', value: title },
      { op: Operation.Add, path: '/fields/System.Description', value: description || '' },
      { op: Operation.Add, path: '/relations/-', value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: `${orgUrl}/_apis/wit/workItems/${parentFeatureId}` } },
    ];
    if (acceptanceCriteria) patch.push({ op: Operation.Add, path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria', value: acceptanceCriteria });
    if (areaPath) patch.push({ op: Operation.Add, path: '/fields/System.AreaPath', value: areaPath });
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

  approvePR: async (conn, args) => {
    const { repositoryId, pullRequestId, project, vote } = schemas.ApprovePRSchema.parse(args);
    const gitApi = await conn.getGitApi();
    // Get current user to use as reviewer ID
    const connection = await conn.connect();
    const authenticatedUser = connection.authenticatedUser;
    if (!authenticatedUser?.id) throw new Error('Could not determine current user ID.');

    const result = await gitApi.createPullRequestReviewer({ vote }, repositoryId, pullRequestId, authenticatedUser.id, project);
    return { content: [{ type: 'text', text: `PR ${pullRequestId} voted with ${vote}. Result: ${result.displayName} (Vote: ${result.vote})` }] };
  },

  mergePR: async (conn, args) => {
    const { repositoryId, pullRequestId, project, commitMessage, deleteSourceBranch, mergeStrategy } = schemas.MergePRSchema.parse(args);
    const gitApi = await conn.getGitApi();
    
    // To merge (complete) a PR, we update it with status 3 (Completed) and provide completion options
    const prUpdate = {
      status: PullRequestStatus.Completed,
      completionOptions: {
        deleteSourceBranch,
        mergeStrategy,
        squashMerge: mergeStrategy === 1,
        bypassPolicy: false,
      },
      lastMergeSourceCommit: undefined // Usually optional, ADO handles it
    } as any;

    if (commitMessage) {
      prUpdate.completionOptions.mergeCommitMessage = commitMessage;
    }

    // We also need the lastMergeSourceCommit to avoid conflicts if ADO requires it
    const currentPR = await gitApi.getPullRequest(repositoryId, pullRequestId, project);
    prUpdate.lastMergeSourceCommit = currentPR.lastMergeSourceCommit;

    const result = await gitApi.updatePullRequest(prUpdate, repositoryId, pullRequestId, project);
    return { content: [{ type: 'text', text: `PR ${pullRequestId} merged (completed) successfully. Status: ${result.status}` }] };
  },

  createPR: async (conn, args) => {
    const { repositoryId, project, title, description, sourceRefName, targetRefName, isDraft } = schemas.CreatePRSchema.parse(args);
    const gitApi = await conn.getGitApi();
    
    const prToCreate = {
      title,
      description: description || '',
      sourceRefName,
      targetRefName,
      isDraft,
    };

    const result = await gitApi.createPullRequest(prToCreate, repositoryId, project);
    return { content: [{ type: 'text', text: `PR created: ${result.pullRequestId} - ${result.title}` }] };
  },

  listWikis: async (conn, args) => {
    const { project } = schemas.ListWikisSchema.parse(args);
    const wikiApi = await conn.getWikiApi();
    const wikis = await wikiApi.getAllWikis(project);
    return { content: [{ type: 'text', text: JSON.stringify(wikis, null, 2) }] };
  },

  getWikiPage: async (conn, args) => {
    const { project, wikiIdentifier, path } = schemas.GetWikiPageSchema.parse(args);
    const wikiApi = await conn.getWikiApi();
    const stream = await wikiApi.getPageText(project, wikiIdentifier, path);
    const content = await new Promise<string>((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk) => data += chunk);
      stream.on('end', () => resolve(data));
      stream.on('error', (err) => reject(err));
    });
    return { content: [{ type: 'text', text: content }] };
  },

  listTestRuns: async (conn, args) => {
    const { project, top } = schemas.ListTestRunsSchema.parse(args);
    const testResultsApi = await conn.getTestResultsApi();
    const runs = await testResultsApi.getTestRuns(project, undefined, undefined, undefined, undefined, undefined, undefined, undefined, top);
    return { content: [{ type: 'text', text: JSON.stringify(runs, null, 2) }] };
  },

  getTestResults: async (conn, args) => {
    const { project, runId, top } = schemas.GetTestResultsSchema.parse(args);
    const testResultsApi = await conn.getTestResultsApi();
    const results = await testResultsApi.getTestResults(project, runId, undefined, undefined, top);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  },

  listVariableGroups: async (conn, args) => {
    const { project, groupName, top } = schemas.ListVariableGroupsSchema.parse(args);
    const taskAgentApi = await conn.getTaskAgentApi();
    const groups = await taskAgentApi.getVariableGroups(project, groupName, undefined, top);
    return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
  },

  getVariableGroup: async (conn, args) => {
    const { project, groupId } = schemas.GetVariableGroupSchema.parse(args);
    const taskAgentApi = await conn.getTaskAgentApi();
    const group = await taskAgentApi.getVariableGroup(project, groupId);
    return { content: [{ type: 'text', text: JSON.stringify(group, null, 2) }] };
  },

  updateVariableGroup: async (conn, args) => {
    const { project, groupId, name, description, variables } = schemas.UpdateVariableGroupSchema.parse(args);
    const taskAgentApi = await conn.getTaskAgentApi();
    const currentGroup = await taskAgentApi.getVariableGroup(project, groupId);
    
    const parameters = {
      name: name || currentGroup.name,
      description: description || currentGroup.description,
      type: currentGroup.type,
      variables: variables ? { ...currentGroup.variables, ...variables } : currentGroup.variables,
      variableGroupProjectReferences: currentGroup.variableGroupProjectReferences
    } as any;

    const result = await taskAgentApi.updateVariableGroup(parameters, groupId);
    return { content: [{ type: 'text', text: `Variable group ${groupId} updated successfully.` }] };
  },

  getPRPolicyEvaluations: async (conn, args) => {
    const { project, artifactId, includeNotApplicable } = schemas.GetPRPolicyEvaluationsSchema.parse(args);
    const policyApi = await conn.getPolicyApi();
    const evaluations = await policyApi.getPolicyEvaluations(project, artifactId, includeNotApplicable);
    return { content: [{ type: 'text', text: JSON.stringify(evaluations, null, 2) }] };
  },

  listWorkItemStates: async (conn, args) => {
    const { processId, witRefName } = schemas.ListWorkItemStatesSchema.parse(args);
    const witProcessApi = await conn.getWorkItemTrackingProcessApi();
    const states = await witProcessApi.getStateDefinitions(processId, witRefName);
    return { content: [{ type: 'text', text: JSON.stringify(states, null, 2) }] };
  },

  listWorkItemFields: async (conn, args) => {
    const { processId, witRefName } = schemas.ListWorkItemFieldsSchema.parse(args);
    const witProcessApi = await conn.getWorkItemTrackingProcessApi();
    const fields = await witProcessApi.getAllWorkItemTypeFields(processId, witRefName);
    return { content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }] };
  },

  triggerPipeline: async (conn, args) => {
    const { pipelineId, project } = schemas.TriggerPipelineSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const result = await buildApi.queueBuild({ definition: { id: pipelineId } }, project);
    return { content: [{ type: 'text', text: `Pipeline triggered: ${result.id}` }] };
  },

  listPipelines: async (conn, args) => {
    const { project } = schemas.ListPipelinesSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const definitions = await buildApi.getDefinitions(project);
    return { content: [{ type: 'text', text: JSON.stringify(definitions.map(d => ({ id: d.id, name: d.name, path: d.path })), null, 2) }] };
  },

  getBuildStatus: async (conn, args) => {
    const { buildId, project } = schemas.GetBuildStatusSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const build = await buildApi.getBuild(project, buildId);
    return { content: [{ type: 'text', text: JSON.stringify({
      id: build.id,
      status: build.status,
      result: build.result,
      startTime: build.startTime,
      finishTime: build.finishTime,
      url: build.url
    }, null, 2) }] };
  },

  getPipelineLogs: async (conn, args) => {
    const { buildId, project } = schemas.GetPipelineLogsSchema.parse(args);
    const buildApi = await conn.getBuildApi();
    const logs = await buildApi.getBuildLogs(project, buildId);
    return { content: [{ type: 'text', text: JSON.stringify(logs, null, 2) }] };
  },
};
