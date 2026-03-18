import { jest, describe, it, expect } from '@jest/globals';
import { sanitizeError, formatWorkItem, formatWorkItemList } from '../src/utils.js';

describe('Security and Sanitization Utility Tests', () => {
  it('should redact URLs in error messages', () => {
    const error = new Error('Failed to connect to https://dev.azure.com/myorg/project/_apis/wit');
    const sanitized = sanitizeError(error);
    expect(sanitized).toContain('[REDACTED_URL]');
    expect(sanitized).not.toContain('https://dev.azure.com');
  });

  it('should redact Personal Access Tokens in error messages', () => {
    const error = new Error('Authentication failed for pat:abcdef1234567890abcdef1234567890');
    const sanitized = sanitizeError(error);
    expect(sanitized).toContain('pat:[REDACTED]');
    expect(sanitized).not.toContain('abcdef1234567890');
  });

  it('should redact Bearer tokens in error messages', () => {
    const error = new Error('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoyNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    const sanitized = sanitizeError(error);
    expect(sanitized).toContain('bearer [REDACTED]');
    expect(sanitized).not.toContain('eyJhbGci');
  });

  it('should provide helpful advice for 401 errors with scopes', () => {
    const error = new Error('(401) Unauthorized');
    const toolScopes = { 'queryWorkItems': 'Work Items (Read)' };
    const sanitized = sanitizeError(error, 'queryWorkItems', toolScopes);
    expect(sanitized).toContain('Authorization failed (401)');
    expect(sanitized).toContain('Work Items (Read)');
  });
});

describe('Optimization Utility Tests', () => {
  it('should format a single work item with essential fields', () => {
    const wi: any = {
      id: 123,
      fields: {
        'System.WorkItemType': 'User Story',
        'System.State': 'Active',
        'System.Title': 'Test Story',
        'System.AssignedTo': { displayName: 'John Doe' },
        'System.TeamProject': 'MyProject',
        'System.Description': 'Story description'
      }
    };
    const formatted = formatWorkItem(wi);
    expect(formatted.id).toBe(123);
    expect(formatted.type).toBe('User Story');
    expect(formatted.assignedTo).toBe('John Doe');
    expect(formatted.url).toBe('[REDACTED_URL]/_workitems/edit/123');
  });

  it('should format a list of work items with minimal fields', () => {
    const items: any[] = [
      { id: 1, fields: { 'System.Title': 'Story 1', 'System.State': 'New' } },
      { id: 2, fields: { 'System.Title': 'Story 2', 'System.State': 'Active' } }
    ];
    const formattedList = formatWorkItemList(items);
    expect(formattedList).toHaveLength(2);
    expect(formattedList[0]).toHaveProperty('title', 'Story 1');
    expect(formattedList[0]).not.toHaveProperty('description');
  });
});
