import type { WorkItem } from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';

export function sanitizeError(error: any, toolName?: string, toolScopes?: Record<string, string>): string {
  let message = error.message || String(error);
  
  // Redact URLs and potential tokens
  message = message.replace(/https:\/\/[^\s]+/g, '[REDACTED_URL]');
  message = message.replace(/pat:[a-zA-Z0-9_-]{30,}/g, 'pat:[REDACTED]');
  message = message.replace(/bearer [a-zA-Z0-9_-]{30,}/gi, 'bearer [REDACTED]');

  if (message.includes('(401)') || message.includes('Unauthorized')) {
    const scope = toolName && toolScopes ? toolScopes[toolName] : null;
    const advice = scope 
      ? `\n\nSuggestion: Ensure your Personal Access Token (PAT) has "${scope}" permissions.`
      : '\n\nSuggestion: Your Personal Access Token (PAT) may be invalid or expired.';
    return `Authorization failed (401). ${advice}`;
  }

  if (message.includes('(403)') || message.includes('Forbidden')) {
    const scope = toolName && toolScopes ? toolScopes[toolName] : null;
    const advice = scope 
      ? `\n\nSuggestion: Your account or PAT does not have permission for "${scope}".`
      : '\n\nSuggestion: Access to this resource is forbidden.';
    return `Access forbidden (403). ${advice}`;
  }

  return message;
}

export function formatWorkItem(wi: WorkItem) {
  if (!wi.fields) return { id: wi.id };
  
  // Return only essential fields to minimize context usage
  return {
    id: wi.id,
    type: wi.fields['System.WorkItemType'],
    state: wi.fields['System.State'],
    title: wi.fields['System.Title'],
    assignedTo: wi.fields['System.AssignedTo']?.displayName || wi.fields['System.AssignedTo'],
    project: wi.fields['System.TeamProject'],
    description: wi.fields['System.Description'] || wi.fields['Microsoft.VSTS.TCM.ReproSteps'],
    url: `[REDACTED_URL]/_workitems/edit/${wi.id}`
  };
}

export function formatWorkItemList(items: WorkItem[]) {
  return items.map(item => ({
    id: item.id,
    type: item.fields?.['System.WorkItemType'],
    title: item.fields?.['System.Title'],
    state: item.fields?.['System.State'],
    assignedTo: item.fields?.['System.AssignedTo']?.displayName || item.fields?.['System.AssignedTo']
  }));
}
