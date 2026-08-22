/**
 * A tolerant parser for the PlantUML subset PowerScroll understands.
 *
 * Two rules govern everything here:
 *
 * 1. It never throws. Malformed input yields diagnostics and whatever could
 *    still be understood, because a diagram that half-renders with a list of
 *    complaints is useful and a blank canvas is not.
 * 2. Styling directives are REPORTED as skipped, never silently dropped. The
 *    renderer supplies the style, so `skinparam` cannot be honoured — but an
 *    author who writes one and sees nothing happen would reasonably conclude it
 *    worked.
 *
 * Not supported, by design: coordinates (PlantUML has none), behaviour ports,
 * collaborations, and conjugated ports. See docs/SRS_DIAGRAM.md.
 */

import type {
  Diagnostic,
  DiagramEntity,
  DiagramPort,
  DiagramRelationship,
  ParseResult,
} from './types';

const CONTAINER_KEYWORD = /^(component|package|node|rectangle|folder|frame|cloud|database)\b/i;
const DECLARATION = /^(component|interface|port|portin|portout|node|artifact|database)\s+(.+)$/i;
const DIRECTIVE =
  /^(skinparam|!|hide\b|show\b|scale\b|title\b|header\b|footer\b|left to right\b|top to bottom\b)/i;
const BRACKET_FORM = /^\[([^\]]+)\](?:\s+as\s+([A-Za-z_]\w*))?$/;

interface NameParts {
  id: string;
  label: string;
  stereotype?: string;
}

function extractStereotype(text: string): { text: string; stereotype?: string } {
  const m = text.match(/<<\s*([^>]+?)\s*>>/);
  if (!m) return { text };
  return { text: text.replace(m[0], '').trim(), stereotype: m[1] };
}

/** Reads `"Quoted" as alias`, `[Bracketed]`, `()Interface`, or a bare name. */
function readName(raw: string): NameParts {
  const { text, stereotype } = extractStereotype(raw.trim());
  const aliased =
    text.match(/^"([^"]*)"\s+as\s+([A-Za-z_]\w*)$/) ||
    text.match(/^\[([^\]]*)\]\s+as\s+([A-Za-z_]\w*)$/) ||
    text.match(/^([A-Za-z_]\w*)\s+as\s+([A-Za-z_]\w*)$/);
  if (aliased) return { label: aliased[1], id: aliased[2], stereotype };

  const plain = text.match(/^"([^"]*)"$/) || text.match(/^\[([^\]]*)\]$/) || text.match(/^\(\)\s*(.+)$/);
  if (plain) {
    const label = plain[1].trim();
    return { label, id: label, stereotype };
  }
  const label = text.replace(/^\(\)/, '').trim();
  return { label, id: label, stereotype };
}

/**
 * PlantUML has no first-class part, so composite-structure roles arrive smuggled
 * inside the display label as `role : Type [multiplicity]`. Splitting it back out
 * here is a convention, not syntax — see the SRS note on this gap.
 */
function applyPartSyntax(entity: DiagramEntity): void {
  const m = entity.label.match(/^(.+?)\s*:\s*([^[\]]+?)\s*(?:\[\s*([^\]]+?)\s*\])?$/);
  if (!m) return;
  entity.isPart = true;
  entity.role = m[1].trim();
  entity.typeName = m[2].trim();
  entity.multiplicity = m[3] ? m[3].trim() : undefined;
}

/** Index of the label separator, ignoring colons inside quotes. */
function labelColonIndex(s: string): number {
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '"') quoted = !quoted;
    else if (c === ':' && !quoted) return i;
  }
  return -1;
}

interface EdgeParts {
  left: string;
  right: string;
  operator: string;
  label?: string;
}

/** Finds the arrow token, tolerating `-->`, `..>`, `-down->`, `-(` and friends. */
function splitRelationship(line: string): EdgeParts | null {
  let text = line;
  let label: string | undefined;
  const colon = labelColonIndex(text);
  if (colon >= 0) {
    label = text.slice(colon + 1).trim() || undefined;
    text = text.slice(0, colon).trim();
  }
  const tokens = text.split(/\s+/);
  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i];
    const looksLikeArrow = /[-.]/.test(t) && /^[<>|().-]*(?:up|down|left|right)?[<>|().-]*$/i.test(t);
    if (!looksLikeArrow) continue;
    const left = tokens.slice(0, i).join(' ');
    const right = tokens.slice(i + 1).join(' ');
    if (left && right) return { left, right, operator: t, label };
  }
  return null;
}

function makeEntity(id: string, label: string, shape: DiagramEntity['shape'], stereotype?: string): DiagramEntity {
  const entity: DiagramEntity = { id, label, shape, stereotype, isPart: false, children: [], ports: [] };
  applyPartSyntax(entity);
  return entity;
}

export function parsePlantUml(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const relationships: DiagramRelationship[] = [];
  const index = new Map<string, DiagramEntity | DiagramPort>();
  const roots: DiagramEntity[] = [];

  /** A frame is either a real entity or a skipped block we still brace-match. */
  type Frame = { entity: DiagramEntity | null };
  const stack: Frame[] = [{ entity: null }];

  const childrenOf = (frame: Frame) => (frame.entity ? frame.entity.children : roots);
  const top = () => stack[stack.length - 1];

  const declare = (entity: DiagramEntity) => {
    index.set(entity.id, entity);
    childrenOf(top()).push(entity);
  };

  const ensureExists = (id: string, line: number) => {
    if (index.has(id)) return;
    declare(makeEntity(id, id, 'component'));
    diagnostics.push({
      line,
      severity: 'ignored',
      message: `Referenced "${id}" was never declared — created as a component so the diagram still renders.`,
    });
  };

  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = i + 1;
    const text = lines[i].trim();

    if (!text || text.startsWith("'")) continue;
    if (/^@(start|end)uml/i.test(text)) continue;

    if (DIRECTIVE.test(text)) {
      diagnostics.push({
        line,
        severity: 'ignored',
        message: 'Styling or preprocessor directive skipped — PowerScroll supplies the style.',
      });
      continue;
    }

    if (text === '}') {
      if (stack.length > 1) stack.pop();
      else diagnostics.push({ line, severity: 'error', message: 'Closing brace with nothing open.' });
      continue;
    }

    const opensBlock = /\{$/.test(text);
    const body = opensBlock ? text.replace(/\{$/, '').trim() : text;

    if (opensBlock) {
      const keyword = body.match(CONTAINER_KEYWORD);
      if (!keyword) {
        diagnostics.push({
          line,
          severity: 'error',
          message: 'Unsupported block — skipped along with its contents.',
        });
        // Still pushed, so the matching brace pops this and not the real parent.
        stack.push({ entity: null });
        continue;
      }
      const parts = readName(body.slice(keyword[1].length).trim());
      const container = makeEntity(parts.id || `anon${line}`, parts.label, 'container', parts.stereotype);
      declare(container);
      stack.push({ entity: container });
      continue;
    }

    // Inside a skipped block, swallow everything until its brace closes.
    if (stack.length > 1 && top().entity === null) continue;

    const edge = splitRelationship(text);
    if (edge) {
      const fromId = readName(edge.left).id;
      const toId = readName(edge.right).id;
      if (!fromId || !toId) {
        diagnostics.push({ line, severity: 'error', message: 'Could not read both ends of this connector.' });
        continue;
      }
      ensureExists(fromId, line);
      ensureExists(toId, line);
      relationships.push({ fromId, toId, label: edge.label, dashed: /\./.test(edge.operator), sourceLine: line });
      continue;
    }

    const declaration = text.match(DECLARATION);
    if (declaration) {
      const keyword = declaration[1].toLowerCase();
      const parts = readName(declaration[2].trim());
      const id = parts.id || `anon${line}`;

      if (keyword === 'port' || keyword === 'portin' || keyword === 'portout') {
        const owner = top().entity;
        if (!owner) {
          diagnostics.push({
            line,
            severity: 'error',
            message: 'A port must sit inside a component — skipped.',
          });
          continue;
        }
        const port: DiagramPort = {
          id,
          label: parts.label,
          direction: keyword === 'portout' ? 'out' : 'in',
          ownerId: owner.id,
        };
        index.set(id, port);
        owner.ports.push(port);
        continue;
      }

      declare(makeEntity(id, parts.label, keyword === 'interface' ? 'interface' : 'component', parts.stereotype));
      continue;
    }

    const bracket = text.match(BRACKET_FORM);
    if (bracket) {
      declare(makeEntity(bracket[2] || bracket[1], bracket[1], 'component'));
      continue;
    }

    diagnostics.push({ line, severity: 'error', message: 'Not recognised — line skipped.' });
  }

  while (stack.length > 1) {
    stack.pop();
    diagnostics.push({
      line: lines.length,
      severity: 'error',
      message: 'Block was never closed — closed it at end of input.',
    });
  }

  return { spec: { roots, relationships }, diagnostics, index };
}
