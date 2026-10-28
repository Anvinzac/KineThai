/**
 * Reader view of the AI prompt kit (lib/sample-pack.ts PACK_KIT_MD). Renders the small
 * Markdown subset the kit uses — headings to ####, paragraphs, bullet lists, inline code,
 * fenced blocks — and turns every JSON block into a JsonView table, with the template's
 * `//` remarks shown as notes under their fields and `<placeholders>` as highlighted slots.
 *
 * The "## Detailed rules" section and everything under it render as nested collapsible
 * sections (native <details>), so the brief, the word-list slot and the sample come first.
 *
 * Exports: PackKitDoc
 * Depends on: ./JsonView, ../lib/useLocale
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { useLocale } from "../lib/useLocale";
import { CodeView, JsonView } from "./JsonView";

const COLLAPSIBLE_TITLE = "Detailed rules";

type Leaf =
  | { kind: "p" | "slot"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; text: string };

type Section = { title: string; level: number; blocks: Leaf[]; children: Section[] };

function parseSections(md: string): Section {
  const root: Section = { title: "", level: 0, blocks: [], children: [] };
  const stack: Section[] = [root];
  const lines = md.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const current = stack[stack.length - 1];
    const heading = /^(#{1,4}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (stack[stack.length - 1].level >= level) stack.pop();
      const section: Section = { title: heading[2], level, blocks: [], children: [] };
      stack[stack.length - 1].children.push(section);
      stack.push(section);
    } else if (line.startsWith("```")) {
      const body: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```")) body.push(lines[i]);
      current.blocks.push({ kind: "code", text: body.join("\n") });
    } else if (line.startsWith("- ")) {
      const prev = current.blocks.at(-1);
      if (prev?.kind === "list") prev.items.push(line.slice(2));
      else current.blocks.push({ kind: "list", items: [line.slice(2)] });
    } else if (/^<[^<>]+>$/.test(line.trim())) {
      current.blocks.push({ kind: "slot", text: line.trim().slice(1, -1) });
    } else if (line.trim()) {
      current.blocks.push({ kind: "p", text: line });
    }
  }
  return root;
}

function inline(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part,
    );
}

function readable(code: string): { value: unknown; notes?: Record<string, string> } | null {
  try {
    return { value: JSON.parse(code) };
  } catch {
    /* template blocks carry remarks and placeholders; try them without */
  }
  const notes: Record<string, string> = {};
  for (const m of code.matchAll(/^\s*"([^"]+)"\s*:.*?\/\/\s*(.+)$/gm)) notes[m[1]] = m[2].trim();
  const cleaned = code
    .replace(/\s*\/\/.*$/gm, "")
    .replace(
      /(^|[^"])<([^<>"\n]+)>/g,
      (_m, before: string, slot: string) => `${before}"⟨${slot}⟩"`,
    );
  try {
    return { value: JSON.parse(cleaned), notes };
  } catch {
    return null;
  }
}

function LeafBlock({ block }: { block: Leaf }) {
  switch (block.kind) {
    case "p":
      return <p>{inline(block.text)}</p>;
    case "slot":
      return <p className="vocab-doc-slot">{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "code": {
      const data = readable(block.text);
      return (
        <div className="vocab-doc-block">
          {data ? (
            <JsonView value={data.value} notes={data.notes} />
          ) : (
            <CodeView text={block.text} />
          )}
        </div>
      );
    }
  }
}

function countSections(section: Section): number {
  return section.children.reduce((n, child) => n + 1 + countSections(child), 0);
}

function SectionView({ section, folded }: { section: Section; folded: boolean }) {
  const collapsible = folded || section.title === COLLAPSIBLE_TITLE;
  const body = (
    <>
      {section.blocks.map((block, i) => (
        <LeafBlock key={i} block={block} />
      ))}
      {section.children.map((child, i) => (
        <SectionView key={i} section={child} folded={collapsible} />
      ))}
    </>
  );
  if (!collapsible) {
    const Heading = section.level === 1 ? "h3" : "h4";
    return (
      <>
        <Heading>{inline(section.title)}</Heading>
        {body}
      </>
    );
  }
  if (section.title === COLLAPSIBLE_TITLE) return <RulesRoot section={section}>{body}</RulesRoot>;
  const count = section.children.length;
  return (
    <details className="vocab-doc-fold" data-depth={Math.min(section.level - 1, 3)}>
      <summary>
        <ChevronRight size={16} aria-hidden="true" />
        <span>{inline(section.title)}</span>
        {count > 0 && <em>{count}</em>}
      </summary>
      <div className="vocab-doc-fold-body">{body}</div>
    </details>
  );
}

/** The outer rules card: its title carries the rule count, and the eye opens every rule. */
function RulesRoot({ section, children }: { section: Section; children: ReactNode }) {
  const ui = useLocale();
  const ref = useRef<HTMLDetailsElement>(null);
  const [allOpen, setAllOpen] = useState(false);
  const count = countSections(section);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sync = () =>
      setAllOpen(root.open && [...root.querySelectorAll("details")].every((d) => d.open));
    root.addEventListener("toggle", sync, true);
    return () => root.removeEventListener("toggle", sync, true);
  }, []);

  const toggleAll = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const root = ref.current;
    if (!root) return;
    const open = !allOpen;
    for (const d of root.querySelectorAll("details")) d.open = open;
    root.open = true;
    setAllOpen(open);
  };

  const toggleLabel = allOpen
    ? ui === "ja"
      ? "すべてのルールを折りたたむ"
      : ui === "th"
        ? "ยุบกฎทั้งหมด"
        : "Thu gọn mọi quy tắc"
    : ui === "ja"
      ? "すべてのルールを開く"
      : ui === "th"
        ? "เปิดกฎทั้งหมด"
        : "Mở tất cả quy tắc";

  return (
    <details ref={ref} className="vocab-doc-fold" data-depth={1}>
      <summary>
        <ChevronRight size={18} aria-hidden="true" />
        <span>
          {count} {section.title.toLowerCase()}
        </span>
        <button
          type="button"
          className="vocab-doc-fold-all"
          aria-pressed={allOpen}
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={toggleAll}
        >
          {allOpen ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </summary>
      <div className="vocab-doc-fold-body">{children}</div>
    </details>
  );
}

export function PackKitDoc({ markdown }: { markdown: string }) {
  const root = parseSections(markdown);
  return (
    <article className="vocab-doc">
      {root.blocks.map((block, i) => (
        <LeafBlock key={i} block={block} />
      ))}
      {root.children.map((section, i) => (
        <SectionView key={i} section={section} folded={false} />
      ))}
    </article>
  );
}
