import { z } from 'zod';
import { PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces.js';

export const QueryWorkItemsSchema = z.object({
  query: z.string().optional(),
  ids: z.array(z.number()).optional(),
  project: z.string().optional(),
  top: z.number().optional().default(50),
});

export const ListRepositoriesSchema = z.object({
  project: z.string().optional(),
});

export const ListWorkItemsByTypeSchema = z.object({
  project: z.string(),
  top: z.number().optional().default(50),
});

export const ListBacklogSchema = z.object({
  project: z.string(),
  top: z.number().optional().default(50),
});

export const UpdateWorkItemSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  reproSteps: z.string().optional(),
  state: z.string().optional(),
  assignedTo: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
});

export const AddCommentSchema = z.object({
  id: z.number(),
  text: z.string(),
});

export const LinkWorkItemsSchema = z.object({
  sourceId: z.number(),
  targetId: z.number(),
  rel: z.string().optional().default('System.LinkTypes.Hierarchy-Forward'),
});

export const ListMetadataSchema = z.object({
  project: z.string(),
});

export const GetFileContentSchema = z.object({
  repositoryId: z.string(),
  path: z.string(),
  version: z.string().optional(),
  project: z.string().optional(),
});

export const SearchCodeSchema = z.object({
  query: z.string(),
  project: z.string().optional(),
  top: z.number().optional().default(10),
});

export const CreateEpicSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  areaPath: z.string().optional(),
  project: z.string(),
});

export const CreateFeatureSchema = z.object({
  title: z.string(),
  parentEpicId: z.number(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  areaPath: z.string().optional(),
  project: z.string(),
});

export const CreateUserStorySchema = z.object({
  title: z.string(),
  parentFeatureId: z.number(),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  areaPath: z.string().optional(),
  project: z.string(),
});

export const CreateBugSchema = z.object({
  title: z.string(),
  reproSteps: z.string(),
  severity: z.string().optional(),
  project: z.string(),
});

export const GetHierarchySchema = z.object({
  id: z.number(),
});

export const ListPRsSchema = z.object({
  repositoryId: z.string(),
  project: z.string().optional(),
  status: z.nativeEnum(PullRequestStatus).optional().default(PullRequestStatus.Active),
  top: z.number().optional().default(20),
});

export const GetPRDiffSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  project: z.string().optional(),
});

export const ListPipelinesSchema = z.object({
  project: z.string(),
});

export const GetBuildStatusSchema = z.object({
  buildId: z.number(),
  project: z.string(),
});

export const GetCurrentUserSchema = z.object({});

export const ListTeamsSchema = z.object({
  project: z.string(),
});

export const ListTeamMembersSchema = z.object({
  project: z.string(),
  teamId: z.string(),
});

export const SearchWorkItemsSchema = z.object({
  project: z.string().optional(),
  searchText: z.string(),
  top: z.number().optional().default(20),
});

export const ListWikisSchema = z.object({
  project: z.string().optional(),
});

export const GetWikiPageSchema = z.object({
  project: z.string(),
  wikiIdentifier: z.string(),
  path: z.string().optional(),
});

export const ListTestRunsSchema = z.object({
  project: z.string(),
  top: z.number().optional().default(50),
});

export const GetTestResultsSchema = z.object({
  project: z.string(),
  runId: z.number(),
  top: z.number().optional().default(50),
});

export const ListVariableGroupsSchema = z.object({
  project: z.string(),
  groupName: z.string().optional(),
  top: z.number().optional().default(50),
});

export const GetVariableGroupSchema = z.object({
  project: z.string(),
  groupId: z.number(),
});

export const UpdateVariableGroupSchema = z.object({
  project: z.string(),
  groupId: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  variables: z.record(z.string(), z.object({
    value: z.string().optional(),
    isSecret: z.boolean().optional(),
  })).optional(),
});

export const GetPRPolicyEvaluationsSchema = z.object({
  project: z.string(),
  artifactId: z.string(), // e.g. "vstfs:///CodeReview/PullRequestId/123"
  includeNotApplicable: z.boolean().optional().default(false),
});

export const ListWorkItemStatesSchema = z.object({
  processId: z.string(),
  witRefName: z.string(),
});
export const ListWorkItemFieldsSchema = z.object({
  processId: z.string(),
  witRefName: z.string(),
});

export const GetProjectProcessIdSchema = z.object({
  project: z.string(),
});

export const CommentOnPRSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  content: z.string(),
  fileName: z.string().optional(),
  line: z.number().optional(),
  project: z.string().optional(),
});

export const ApprovePRSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  project: z.string().optional(),
  vote: z.number().optional().default(10), // 10 = Approved, 5 = Approved with suggestions, 0 = No vote, -5 = Waiting for author, -10 = Rejected
});

export const MergePRSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  project: z.string().optional(),
  commitMessage: z.string().optional(),
  deleteSourceBranch: z.boolean().optional().default(true),
  mergeStrategy: z.number().optional().default(0), // 0 = NoFastForward, 1 = Squash, 2 = Rebase, 3 = RebaseMerge
});

export const CreatePRSchema = z.object({
  repositoryId: z.string(),
  project: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  sourceRefName: z.string(),
  targetRefName: z.string().optional().default('refs/heads/main'),
  isDraft: z.boolean().optional().default(false),
});

export const TriggerPipelineSchema = z.object({
  pipelineId: z.number(),
  project: z.string(),
  branch: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
});

export const GetPipelineLogsSchema = z.object({
  buildId: z.number(),
  project: z.string(),
});
