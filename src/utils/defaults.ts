import type { WorkspaceData, Section, Page, TextOptions, CanvasNode } from '../types/data';
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
    version: '0.1.0',
    filename: 'Untitled Notebook',
    sections: [createSection('Section 1')],
  };
}

export function createContainerNode(x: number, y: number): CanvasNode {
  return {
    id: generateId(),
    type: 'container',
    x,
    y,
    width: 300,
    height: 200,
    data: {
      title: 'Container',
      isCollapsed: false,
      headerHeight: 32,
      fill: '#ffffff',
      borderColor: '#d4d4d4',
    },
  };
}

export const defaultTextOptions: TextOptions = {
  fontSize: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontStyle: 'normal',
  fill: '#1a1a1a',
};
