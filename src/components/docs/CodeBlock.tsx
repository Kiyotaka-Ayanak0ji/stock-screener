import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  /** Optional label shown above the block, for example "Terminal". */
  label?: string;
  className?: string;
}

const copyText = async (value: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the textarea fallback below */
  }
  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
};

/**
 * Command / code block with a one click copy button for the whole block and a
 * per line copy button so a single command can be reused on its own.
 */
export const CodeBlock = ({ code, label, className }: CodeBlockProps) => {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const lines = code.replace(/\s+$/, "").split("\n");

  const handleCopyAll = async () => {
    if (await copyText(code)) {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    }
  };

  const handleCopyLine = async (line: string, index: number) => {
    // Copy only the command, dropping any trailing inline comment.
    const command = line.split("#")[0].trim();
    if (!command) return;
    if (await copyText(command)) {
      setCopiedLine(index);
      window.setTimeout(() => setCopiedLine((c) => (c === index ? null : c)), 1800);
    }
  };

  return (
    <div className={cn("group/block relative mt-5 rounded-xl border border-border bg-muted/60", className)}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label || "Terminal"}
        </span>
        <button
          type="button"
          onClick={handleCopyAll}
          aria-label="Copy all commands"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {copiedAll ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copiedAll ? "Copied" : "Copy all"}
        </button>
      </div>

      <div className="overflow-x-auto p-2">
        {lines.map((line, i) => {
          const isBlank = line.trim().length === 0;
          return (
            <div
              key={i}
              className={cn(
                "group/line flex items-start gap-2 rounded-md px-2 py-0.5",
                !isBlank && "hover:bg-background/60",
              )}
            >
              <code className="flex-1 whitespace-pre font-mono text-xs leading-relaxed text-foreground">
                {isBlank ? " " : line}
              </code>
              {!isBlank && (
                <button
                  type="button"
                  onClick={() => handleCopyLine(line, i)}
                  aria-label={`Copy: ${line.split("#")[0].trim()}`}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/line:opacity-100"
                >
                  {copiedLine === i ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CodeBlock;
