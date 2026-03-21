import type { WorkspaceData, Section, Page, TextOptions } from '../types/data';
import { generateId } from './ids';

export function createPage(title = 'Untitled Page'): Page {
  return {
    id: generateId(),
    title,
    nodes: [],
  };
}

export function createSection(title = 'New Section'): Section {
  return {
    id: generateId(),
    title,
    pages: [createPage('Page 1')],
  };
}

export function createWorkspace(): WorkspaceData {
  return {
    version: '0.2.0',
    filename: 'Untitled Notebook',
    sections: [createSection('Section 1')],
  };
}

export const defaultTextOptions: TextOptions = {
  fontSize: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontStyle: 'normal',
  fill: '#1a1a1a',
};
