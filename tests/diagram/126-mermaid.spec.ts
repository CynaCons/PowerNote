/**
 * Test 126: Mermaid flowcharts and sequences
 * Covers: REQ-DIAG-090..098
 *
 * A third grammar feeding the same pipeline. These check that the format is
 * chosen rather than guessed, that the subset parses into the shared spec types,
 * that a labelled flow arrow stays an arrow instead of becoming a UML assembly,
 * and that everything outside the subset is refused loudly.
 */
import { test, expect } from '@playwright/test';
import { getCanvasStore, waitForCanvasReady, waitForBridgeReady, runBridge, runBridgeExpectingError } from '../helpers';

const FLOWCHART = `flowchart LR
  A[Read sensor] --> B{Uplink up?}
  B -->|yes| C[Send batch]
  B -->|no| D[Store and forward]
  D --- C`;

const SEQUENCE = `sequenceDiagram
  participant S as Sensor
  participant G as Gateway
  S->>G: telemetry burst
  G-->>S: ack`;

test.describe('126 - Mermaid diagrams (REQ-DIAG-090..098)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvasReady(page);
    await waitForBridgeReady(page);
  });

  test('a Mermaid header is detected and a PlantUML source is not', async ({ page }) => {
    const routing = await page.evaluate(async () => {
      const mod = await import('/src/diagram/mermaid.ts');
      return {
        flowchart: mod.looksLikeMermaid('flowchart TD\nA-->B'),
        graph: mod.looksLikeMermaid('%% a comment\ngraph LR\nA-->B'),
        sequence: mod.looksLikeMermaid('sequenceDiagram\nA->>B: hi'),
        component: mod.looksLikeMermaid('@startuml\ncomponent a\n@enduml'),
        activity: mod.looksLikeMermaid('|Lane|\nstart\n:go;\nstop'),
        prose: mod.looksLikeMermaid('just some words'),
      };
    });
    expect(routing.flowchart).toBe(true);
    expect(routing.graph).toBe(true);
    expect(routing.sequence).toBe(true);
    // The PlantUML grammars must never be mistaken for Mermaid.
    expect(routing.component).toBe(false);
    expect(routing.activity).toBe(false);
    expect(routing.prose).toBe(false);
  });

  test('nodes, shapes and edges parse into the shared spec types', async ({ page }) => {
    const parsed = await page.evaluate(async (src) => {
      const mod = await import('/src/diagram/mermaid.ts');
      const { spec, diagnostics, index } = mod.parseMermaid(src);
      return {
        ids: spec.roots.map((e: any) => e.id),
        labels: spec.roots.map((e: any) => e.label),
        stereotypes: spec.roots.map((e: any) => e.stereotype),
        edges: spec.relationships.map((r: any) => [r.fromId, r.toId, r.label ?? null, r.arrowhead !== false]),
        indexed: index.size,
        diagnostics,
      };
    }, FLOWCHART);

    expect(parsed.ids).toEqual(['A', 'B', 'C', 'D']);
    expect(parsed.labels).toEqual(['Read sensor', 'Uplink up?', 'Send batch', 'Store and forward']);
    // Shape travels as a stereotype because the shared layout has one box shape.
    expect(parsed.stereotypes).toEqual(['step', 'decision', 'step', 'step']);
    expect(parsed.edges).toEqual([
      ['A', 'B', null, true],
      ['B', 'C', 'yes', true],
      ['B', 'D', 'no', true],
      // `---` is undirected and must not grow an arrowhead.
      ['D', 'C', null, false],
    ]);
    expect(parsed.indexed).toBe(4);
    // LR is the direction the row layout actually produces, so nothing is lost.
    expect(parsed.diagnostics).toEqual([]);
  });

  test('a chain is one statement and a bare id is a node', async ({ page }) => {
    const parsed = await page.evaluate(async () => {
      const mod = await import('/src/diagram/mermaid.ts');
      const { spec, diagnostics } = mod.parseMermaid('flowchart LR\nA --> B --> C\nB[Middle]');
      return {
        ids: spec.roots.map((e: any) => e.id),
        labels: spec.roots.map((e: any) => e.label),
        edges: spec.relationships.map((r: any) => `${r.fromId}->${r.toId}`),
        diagnostics,
      };
    });
    expect(parsed.ids).toEqual(['A', 'B', 'C']);
    // An id mentioned before it is labelled still picks the label up.
    expect(parsed.labels).toEqual(['A', 'Middle', 'C']);
    expect(parsed.edges).toEqual(['A->B', 'B->C']);
    // Mermaid defines a node by mentioning it, so a bare id is not a complaint.
    expect(parsed.diagnostics).toEqual([]);
  });

  test('a non-LR direction is reported rather than silently ignored', async ({ page }) => {
    const diags = await page.evaluate(async () => {
      const mod = await import('/src/diagram/mermaid.ts');
      return mod.parseMermaid('flowchart TD\nA-->B').diagnostics;
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe('ignored');
    expect(diags[0].message).toContain('TD');
    expect(diags[0].message).toContain('left to right');
  });

  test('everything outside the subset is refused, not drawn wrong', async ({ page }) => {
    const cases = await page.evaluate(async () => {
      const mod = await import('/src/diagram/mermaid.ts');
      const messages = (src: string) =>
        mod.parseMermaid(src).diagnostics.map((d: any) => `${d.severity}:${d.message}`);
      return {
        notMermaid: messages('@startuml\ncomponent a\n@enduml'),
        dotted: messages('flowchart LR\nA-.->B'),
        thick: messages('flowchart LR\nA==>B'),
        compound: messages('flowchart LR\nA[[Sub]] --> B'),
        subgraph: messages('flowchart LR\nsubgraph one\nA-->B\nend'),
        styling: messages('flowchart LR\nA-->B\nstyle A fill:#f00'),
        block: messages('sequenceDiagram\nloop every minute\nA->>B: poll\nend'),
      };
    });

    expect(cases.notMermaid.join(' ')).toContain('not Mermaid');
    expect(cases.dotted.join(' ')).toMatch(/error:.*dotted/);
    expect(cases.thick.join(' ')).toMatch(/error:.*thick/);
    expect(cases.compound.join(' ')).toMatch(/error:.*compound node shape/);
    expect(cases.subgraph.join(' ')).toMatch(/error:.*Subgraphs are not supported/);
    // Styling is skipped, not refused — PowerScroll supplies the style.
    expect(cases.styling.join(' ')).toMatch(/ignored:.*PowerScroll supplies the style/);
    expect(cases.block.join(' ')).toMatch(/error:.*Blocks are not supported/);
  });

  test('a labelled flow arrow stays an arrow instead of becoming an assembly', async ({ page }) => {
    const kinds = await page.evaluate(async () => {
      const mermaid = await import('/src/diagram/mermaid.ts');
      const layout = await import('/src/diagram/layout.ts');
      const { spec, index } = mermaid.parseMermaid('flowchart LR\nA[One] -->|guard| B[Two]');
      const laid = layout.layoutDiagram(spec, index, (t: string) => t.length * 7);
      return laid.relationships.map((r: any) => r.kind);
    });
    // A labelled PlantUML component link derives to an assembly; a guard on a
    // flowchart edge must not.
    expect(kinds).toEqual(['dependency']);
  });

  test('an agent draws a Mermaid flowchart as native canvas nodes', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: FLOWCHART,
      title: 'Uplink decision',
      format: 'mermaid',
    });

    expect(result.format).toBe('mermaid');
    expect(result.diagnostics).toEqual([]);
    expect(result.elementCount).toBeGreaterThan(8);

    const store = await getCanvasStore(page);
    const frame = store.nodes.find((n: any) => n.id === result.diagramId);
    expect(frame.type).toBe('diagram');

    const members = store.nodes.filter((n: any) => n.groupId === result.diagramId && n.id !== frame.id);
    expect(members.every((n: any) => n.type === 'shape' || n.type === 'text')).toBe(true);

    const labels = members.filter((n: any) => n.type === 'text').map((n: any) => n.data.text);
    expect(labels).toContain('Read sensor');
    expect(labels).toContain('Uplink up?');
    expect(labels).toContain('«decision»');
    expect(labels).toContain('yes');

    // No ball-and-socket: an arc would mean a flow edge was read as an assembly.
    expect(members.some((n: any) => n.data.shapeType === 'arc')).toBe(false);
  });

  test('a sequence draws numbered messages, with replies dashed', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', {
      source: SEQUENCE,
      title: 'Telemetry',
      format: 'mermaid',
    });

    // The one note is the standing caveat about lifelines, not a parse failure.
    expect(result.diagnostics.every((d: any) => d.severity === 'ignored')).toBe(true);

    const store = await getCanvasStore(page);
    const members = store.nodes.filter((n: any) => n.groupId === result.diagramId && n.id !== result.diagramId);
    const labels = members.filter((n: any) => n.type === 'text').map((n: any) => n.data.text);
    expect(labels).toContain('Sensor');
    expect(labels).toContain('Gateway');
    // Numbered because a row of participants cannot show order any other way.
    expect(labels).toContain('1: telemetry burst');
    expect(labels).toContain('2: ack');

    // `-->>` is a reply, and a reply is dashed.
    const dashed = members.filter((n: any) => n.type === 'shape' && n.data.strokeDash?.length > 0);
    expect(dashed.length).toBe(1);
  });

  test('the declared format is enforced, not merely a hint', async ({ page }) => {
    // Mermaid source sent to the PlantUML tool would otherwise render entities
    // literally named "A[Read sensor]".
    const err = await runBridgeExpectingError(page, 'create_diagram', {
      source: FLOWCHART,
      format: 'plantuml',
    });
    expect(err.code).toBe('PRECONDITION');
    expect(err.message).toContain('Mermaid');

    // And PlantUML source sent to the Mermaid tool is refused at the header.
    const other = await runBridgeExpectingError(page, 'create_diagram', {
      source: '@startuml\ncomponent a\ncomponent b\na --> b\n@enduml',
      format: 'mermaid',
    });
    expect(other.code).toBe('PRECONDITION');

    const bad = await runBridgeExpectingError(page, 'create_diagram', {
      source: FLOWCHART,
      format: 'graphviz',
    });
    expect(bad.code).toBe('BAD_PARAMS');
  });

  test('without a format the source still routes itself', async ({ page }) => {
    const result = await runBridge(page, 'create_diagram', { source: FLOWCHART });
    expect(result.format).toBe('mermaid');
    expect(result.elementCount).toBeGreaterThan(8);
  });
});
