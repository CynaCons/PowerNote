/**
 * Resolving a page's canvas look.
 *
 * Guide style and background colour live in two places: a notebook-wide default
 * on `WorkspaceData.settings`, and an optional per-page override on
 * `Page.settings`. Three layers deep counting the built-in defaults, and every
 * one of them may be absent — which is exactly the shape that goes wrong when
 * each call site does its own `??` chain and one of them forgets a layer.
 *
 * So this is the only read path. Components and bridge commands ask here.
 */

import type { Page, WorkspaceData, WorkspaceSettings } from '../types/data';
import { DEFAULT_WORKSPACE_SETTINGS } from './defaults';

/** Where a resolved value came from — what the settings panel labels. */
export type SettingsScope = 'page' | 'notebook';

export interface ResolvedPageSettings extends WorkspaceSettings {
  /** Per field, so a page pinning only its guide style reports honestly. */
  source: Record<keyof WorkspaceSettings, SettingsScope>;
  /** True when the page overrides anything at all. */
  hasOverride: boolean;
}

/** The notebook-wide default, itself falling back to the built-in one. */
export function notebookSettings(workspace: WorkspaceData): WorkspaceSettings {
  return { ...DEFAULT_WORKSPACE_SETTINGS, ...(workspace.settings ?? {}) };
}

/**
 * The look to draw a page with, plus where each value came from.
 *
 * A page override wins field by field: pinning the guide style leaves the
 * colour following the notebook, rather than freezing whatever it happened to
 * be at the moment the override was made.
 */
export function resolvePageSettings(
  page: Page | undefined,
  workspace: WorkspaceData,
): ResolvedPageSettings {
  const base = notebookSettings(workspace);
  const override = page?.settings ?? {};

  const source: Record<keyof WorkspaceSettings, SettingsScope> = {
    backgroundMode: override.backgroundMode !== undefined ? 'page' : 'notebook',
    bgColor: override.bgColor !== undefined ? 'page' : 'notebook',
  };

  return {
    ...base,
    ...override,
    source,
    hasOverride: source.backgroundMode === 'page' || source.bgColor === 'page',
  };
}
