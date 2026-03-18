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
  state: z.string().optional(),
  assignedTo: z.string().optional(),
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
  areaPath: z.string().optional(),
  project: z.string(),
});

export const CreateFeatureSchema = z.object({
  title: z.string(),
  parentEpicId: z.number(),
  description: z.string().optional(),
  project: z.string(),
});

export const CreateUserStorySchema = z.object({
  title: z.string(),
  parentFeatureId: z.number(),
  description: z.string().optional(),
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

export const CommentOnPRSchema = z.object({
  repositoryId: z.string(),
  pullRequestId: z.number(),
  content: z.string(),
  fileName: z.string().optional(),
  line: z.number().optional(),
  project: z.string().optional(),
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
