/**
 * A tolerant parser for the Mermaid subset PowerNote understands.
 *
 * Mermaid is a third grammar beside the two PlantUML ones, and it earns its
 * place for one reason: agents write it fluently and reach for it first. It
 * produces the SAME spec types the PlantUML parsers produce, so measure, layout
 * and materialize are shared — what lands on the canvas is native shape and text
 * nodes whatever language described it.
 *
 * The two rules from `plantuml.ts` hold here: never throw, and REPORT what was
 * skipped rather than dropping it silently. Two more are specific to Mermaid:
 *
 * 1. Shape travels as a STEREOTYPE, not as geometry. The shared layout draws one
 *    rounded box per entity, so `A{Check}` renders as a box carrying «decision»
 *    rather than as a diamond that came out looking like a box. Saying what was
 *    meant beats showing something else.
 * 2. Flow edges carry `flow`. A label on a flowchart arrow is a guard, not an
 *    interface name, so the UML derivation that turns a labelled component link
 *    into a ball-and-socket assembly must not run on one.
 *
 * Out of subset, and refused rather than mis-drawn: subgraphs, dotted and thick
 * links, compound node shapes, and the sequence loop/alt/note blocks. Class,
 * state, ER and Gantt sources are not Mermaid-flowchart at all and are rejected
 * at the header.
 */

import type {
  Diagnostic,
  DiagramEntity,
  DiagramPort,
  DiagramRelationship,
  ParseResult,
} from './types';

/** Mermaid families this subset reads. Both end up in the component pipeline. */
export type MermaidKind = 'flowchart' | 'sequence';

export interface MermaidHeader {
  kind: MermaidKind;
  /** Flowchart only. Recorded so the source can be told its direction was lost. */
  direction: string;
  /** 1-based line the header sat on. */
  line: number;
}

/**
 * Ids exclude `-` on purpose. Mermaid's own tokeniser cannot tell `A-->B` from
 * an id ending in a dash either, and allowing one here would make `A-->>B` parse
 * as a solid message with the dash eaten by the name.
 */
const ID = '[A-Za-z0-9_][A-Za-z0-9_.]*';
const NODE = new RegExp(`^(${ID})(?:\\[(.*)\\]|\\((.*)\\)|\\{(.*)\\})?$`);

const DIRECTIONS = new Set(['TB', 'TD', 'BT', 'LR', 'RL']);

/** Link forms Mermaid has that this subset does not draw. */
const OTHER_LINK = /-\.-|={2,}|~~~|<-{2,}|-{2,}[ox](?![\w])/;

const SEQ_MESSAGE = new RegExp(`^(${ID})\\s*(-{1,2}>>)([+-]?)\\s*(${ID})\\s*:\\s*(.*)$`);
const SEQ_PARTICIPANT = /^(?:participant|actor)\s+(.+)$/i;
const SEQ_ALIAS = new RegExp(`^(${ID})\\s+as\\s+(.+)$`, 'i');
const SEQ_BLOCK = /^(loop|alt|opt|par|critical|break|rect|box|note|activate|deactivate)\b/i;

function isComment(text: string): boolean {
  return text.startsWith('%%');
}

/** Strips the quotes Mermaid allows around a label. */
function unquote(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^"(.*)"$/) || trimmed.match(/^'(.*)'$/);
  return (m ? m[1] : trimmed).trim();
}

/**
 * Mermaid states its family on the first line, so detection is a header read
 * rather than a guess about the body — which is what makes it safe to sniff
 * ahead of the PlantUML grammars.
 */
export function readMermaidHeader(source: string): MermaidHeader | null {
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i].trim().replace(/;$/, '').trim();
    if (!text || isComment(text)) continue;

    const flow = text.match(/^(?:flowchart|graph)(?:\s+([A-Za-z]{2}))?$/i);
    if (flow) {
      const direction = (flow[1] ?? 'TD').toUpperCase();
      if (flow[1] && !DIRECTIONS.has(direction)) return null;
      return { kind: 'flowchart', direction, line: i + 1 };
    }
    if (/^sequenceDiagram$/i.test(text)) return { kind: 'sequence', direction: 'TD', line: i + 1 };

    // The first real line decides. Anything else is some other language.
    return null;
  }
  return null;
}

/** True when a source announces itself as one of the Mermaid families we read. */
export function looksLikeMermaid(source: string): boolean {
  return readMermaidHeader(source) !== null;
}

type NodeRead =
  | { ok: true; id: string; label?: string; stereotype?: string }
  | { ok: false; reason: string };

/** Reads `A`, `A[Label]`, `A(Label)` or `A{Label}`. */
function readNode(raw: string): NodeRead {
  const text = raw.trim();
  if (!text) return { ok: false, reason: 'A link is missing one of its ends' };

  const m = text.match(NODE);
  if (!m) {
    return {
      ok: false,
      reason: `"${text}" is not an id with an optional [label], (label) or {label}`,
    };
  }

  const boxed = m[2] ?? m[3] ?? m[4];
  if (boxed === undefined) return { ok: true, id: m[1] };
  // `A[[Sub]]`, `A((Circle))`, `A[/Slanted/]` and friends: real Mermaid shapes
  // with no counterpart here, refused rather than drawn as a plain box.
  if (/^[[({>/\\]/.test(boxed)) {
    return {
      ok: false,
      reason: `"${text}" uses a compound node shape; only [label], (label) and {label} are read`,
    };
  }
  return { ok: true, id: m[1], label: unquote(boxed), stereotype: m[4] !== undefined ? 'decision' : 'step' };
}

interface FlowLink {
  label?: string;
  arrowhead: boolean;
}

const NODE_LABELS = /\[[^\]]*\]|\([^)]*\)|\{[^}]*\}/g;
const LINK_LABELS = /\|[^|]*\|/g;

/**
 * Blanks out the inside of bracketed spans, KEEPING the original length so match
 * indices still line up. Label text is prose — `A[a --> b]` and `A[x == y]` are
 * both legal — and scanning it for link operators would tear a node in half.
 */
function mask(text: string, pattern: RegExp): string {
  return text.replace(pattern, (m) => m[0] + '_'.repeat(Math.max(0, m.length - 2)) + m[m.length - 1]);
}

/**
 * Splits `A --> B -->|yes| C` into its ends and the links between them.
 *
 * Chains are one statement in Mermaid, so they are one here too, or an author's
 * three-node line silently becomes a single edge.
 */
function splitFlow(text: string): { ends: string[]; links: FlowLink[] } {
  const scan = mask(text, NODE_LABELS);
  const link = /(-{2,}>|-{3,})(?:\s*\|([^|]*)\|)?/g;
  const ends: string[] = [];
  const links: FlowLink[] = [];
  let cursor = 0;
  let m = link.exec(scan);
  while (m !== null) {
    ends.push(text.slice(cursor, m.index));
    const label = text.slice(m.index, m.index + m[0].length).match(/\|([^|]*)\|/);
    links.push({ arrowhead: m[1].endsWith('>'), label: label?.[1].trim() || undefined });
    cursor = m.index + m[0].length;
    m = link.exec(scan);
  }
  ends.push(text.slice(cursor));
  return { ends, links };
}

export function parseMermaid(source: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const relationships: DiagramRelationship[] = [];
  const index = new Map<string, DiagramEntity | DiagramPort>();
  const roots: DiagramEntity[] = [];
  const entities = new Map<string, DiagramEntity>();
  const lines = source.split(/\r?\n/);

  const header = readMermaidHeader(source);
  if (!header) {
    diagnostics.push({
      line: 0,
      severity: 'error',
      message:
        'This is not Mermaid: the first line must be "flowchart TD", "graph LR" or ' +
        '"sequenceDiagram". PlantUML source belongs to the PlantUML tool.',
    });
    return { spec: { roots, relationships }, diagnostics, index };
  }

  const defaultStereotype = header.kind === 'sequence' ? 'participant' : 'step';

  /**
   * Declares an id, or fills in a declaration for one already referenced.
   * Mermaid defines a node by mentioning it, so a bare id is not a mistake and
   * must not produce a diagnostic the way an undeclared PlantUML name does.
   */
  const upsert = (id: string, label?: string, stereotype?: string): void => {
    const existing = entities.get(id);
    if (!existing) {
      const entity: DiagramEntity = {
        id,
        label: label ?? id,
        shape: 'component',
        stereotype: stereotype ?? defaultStereotype,
        isPart: false,
        children: [],
        ports: [],
      };
      entities.set(id, entity);
      index.set(id, entity);
      roots.push(entity);
      return;
    }
    // Only a mention carrying a shape is a declaration; a later bare reference
    // must not demote `A{Check}` back to a plain step.
    if (label !== undefined) existing.label = label;
    if (stereotype !== undefined) existing.stereotype = stereotype;
  };

  if (header.kind === 'flowchart') {
    if (header.direction !== 'LR') {
      diagnostics.push({
        line: header.line,
        severity: 'ignored',
        message:
          `Direction ${header.direction} is not honoured — nodes are placed left to right ` +
          'and the arrows carry the flow.',
      });
    }
    parseFlowchart(lines, header, diagnostics, relationships, upsert);
  } else {
    diagnostics.push({
      line: header.line,
      severity: 'ignored',
      message:
        'Drawn as participants side by side with numbered messages between them — ' +
        'lifelines running down the page are not built yet.',
    });
    parseSequence(lines, header, diagnostics, relationships, upsert);
  }

  return { spec: { roots, relationships }, diagnostics, index };
}

type Upsert = (id: string, label?: string, stereotype?: string) => void;

function parseFlowchart(
  lines: string[],
  header: MermaidHeader,
  diagnostics: Diagnostic[],
  relationships: DiagramRelationship[],
  upsert: Upsert,
): void {
  let openSubgraphs = 0;

  for (let i = header.line; i < lines.length; i += 1) {
    const line = i + 1;
    const text = lines[i].trim().replace(/;$/, '').trim();
    if (!text) continue;
    if (isComment(text)) {
      if (text.startsWith('%%{')) {
        diagnostics.push({
          line,
          severity: 'ignored',
          message: 'Init directive skipped — PowerNote supplies the style.',
        });
      }
      continue;
    }

    if (/^(style|classDef|class|click|linkStyle|direction)\b/i.test(text)) {
      diagnostics.push({
        line,
        severity: 'ignored',
        message: 'Styling or interaction directive skipped — PowerNote supplies the style.',
      });
      continue;
    }

    if (/^subgraph\b/i.test(text)) {
      openSubgraphs += 1;
      diagnostics.push({
        line,
        severity: 'error',
        message: 'Subgraphs are not supported yet — the nodes inside are still drawn, the box is not.',
      });
      continue;
    }
    if (/^end$/i.test(text)) {
      // Closing a subgraph we already complained about; saying so twice helps nobody.
      if (openSubgraphs > 0) openSubgraphs -= 1;
      else diagnostics.push({ line, severity: 'error', message: 'Stray "end" — line skipped.' });
      continue;
    }

    if (OTHER_LINK.test(mask(mask(text, NODE_LABELS), LINK_LABELS))) {
      diagnostics.push({
        line,
        severity: 'error',
        message: 'Only "-->", "---" and their labelled forms are drawn — dotted, thick and circle/cross links are refused rather than drawn as a plain arrow.',
      });
      continue;
    }

    const { ends, links } = splitFlow(text);

    if (links.length === 0) {
      const read = readNode(text);
      if (!read.ok) {
        diagnostics.push({ line, severity: 'error', message: `${read.reason} — line skipped.` });
        continue;
      }
      upsert(read.id, read.label, read.stereotype);
      continue;
    }

    const reads = ends.map(readNode);
    const broken = reads.find((r): r is { ok: false; reason: string } => !r.ok);
    if (broken) {
      // Half a chain is worse than none: it would draw edges the author never wrote.
      diagnostics.push({ line, severity: 'error', message: `${broken.reason} — line skipped.` });
      continue;
    }

    const ok = reads as { ok: true; id: string; label?: string; stereotype?: string }[];
    for (const read of ok) upsert(read.id, read.label, read.stereotype);
    for (let k = 0; k < links.length; k += 1) {
      relationships.push({
        fromId: ok[k].id,
        toId: ok[k + 1].id,
        label: links[k].label,
        dashed: false,
        sourceLine: line,
        flow: true,
        arrowhead: links[k].arrowhead,
      });
    }
  }
}

function parseSequence(
  lines: string[],
  header: MermaidHeader,
  diagnostics: Diagnostic[],
  relationships: DiagramRelationship[],
  upsert: Upsert,
): void {
  let messageNo = 0;

  for (let i = header.line; i < lines.length; i += 1) {
    const line = i + 1;
    const text = lines[i].trim().replace(/;$/, '').trim();
    if (!text || isComment(text)) continue;

    if (/^autonumber\b/i.test(text)) {
      diagnostics.push({
        line,
        severity: 'ignored',
        message: 'autonumber skipped — messages are numbered here in every case.',
      });
      continue;
    }

    const participant = text.match(SEQ_PARTICIPANT);
    if (participant) {
      const rest = participant[1].trim();
      const alias = rest.match(SEQ_ALIAS);
      if (alias) {
        upsert(alias[1], unquote(alias[2]), 'participant');
      } else if (new RegExp(`^${ID}$`).test(rest)) {
        upsert(rest, undefined, 'participant');
      } else {
        diagnostics.push({
          line,
          severity: 'error',
          message: `"${rest}" is not a participant id, optionally followed by "as Label" — line skipped.`,
        });
      }
      continue;
    }

    const message = text.match(SEQ_MESSAGE);
    if (message) {
      if (message[3]) {
        diagnostics.push({
          line,
          severity: 'ignored',
          message: 'Activation marker skipped — the message is drawn, the activation bar is not.',
        });
      }
      upsert(message[1]);
      upsert(message[4]);
      messageNo += 1;
      relationships.push({
        fromId: message[1],
        toId: message[4],
        // Numbered because the row layout cannot show order the way a lifeline
        // does, and order is the one thing a sequence is about.
        label: `${messageNo}: ${message[5].trim()}`,
        dashed: message[2].startsWith('--'),
        sourceLine: line,
        flow: true,
        arrowhead: true,
      });
      continue;
    }

    if (/^end$/i.test(text) || SEQ_BLOCK.test(text)) {
      diagnostics.push({
        line,
        severity: 'error',
        message:
          'Blocks are not supported yet — loop, alt, opt, par, note and activate are refused ' +
          'rather than drawn as if they were plain messages.',
      });
      continue;
    }

    if (/-{1,2}[->x)]/.test(text)) {
      diagnostics.push({
        line,
        severity: 'error',
        message: 'Only "A->>B: message" and "A-->>B: reply" are read — line skipped.',
      });
      continue;
    }

    diagnostics.push({ line, severity: 'error', message: 'Not recognised — line skipped.' });
  }
}
