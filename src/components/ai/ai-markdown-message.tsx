"use client";

import React from "react";

interface AiMarkdownMessageProps {
  content: string;
}

export function AiMarkdownMessage({ content }: AiMarkdownMessageProps) {
  if (!content) return null;

  // Split content into blocks (paragraphs, tables, lists, headers)
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let tableRows: string[] = [];
  let inTable = false;
  let blockKey = 0;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const headerRow = tableRows[0];
    const dataRows = tableRows.slice(2); // Skip separator row (---|---|---)

    const parseCells = (row: string) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);

    const headers = parseCells(headerRow);

    blocks.push(
      <div key={`table-${blockKey++}`} className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {headers.map((h, i) => (
                <th key={i} className="py-2 px-3 font-bold text-slate-300">
                  {renderInlineFormatting(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {dataRows.map((row, rIdx) => {
              const cells = parseCells(row);
              return (
                <tr key={rIdx} className="hover:bg-white/[0.02]">
                  {cells.map((c, cIdx) => (
                    <td key={cIdx} className="py-2 px-3 text-slate-300">
                      {renderInlineFormatting(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      tableRows.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Blank line
    if (!trimmed) {
      continue;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 key={blockKey++} className="text-sm font-bold text-indigo-200 mt-3 mb-1.5 flex items-center gap-1.5">
          {renderInlineFormatting(trimmed.slice(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 key={blockKey++} className="text-base font-black text-white mt-4 mb-2 pb-1 border-b border-white/10">
          {renderInlineFormatting(trimmed.slice(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2 key={blockKey++} className="text-lg font-black text-white mt-4 mb-2">
          {renderInlineFormatting(trimmed.slice(2))}
        </h2>
      );
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith("> ")) {
      blocks.push(
        <blockquote key={blockKey++} className="my-2 pl-3 border-l-2 border-indigo-400/60 bg-indigo-500/10 py-1.5 pr-2 rounded-r-lg text-xs italic text-indigo-200">
          {renderInlineFormatting(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push(
        <div key={blockKey++} className="flex items-start gap-2 my-1 text-xs text-slate-300 pl-1">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
          <div className="flex-1">{renderInlineFormatting(trimmed.slice(2))}</div>
        </div>
      );
      continue;
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div key={blockKey++} className="flex items-start gap-2 my-1 text-xs text-slate-300 pl-1">
          <span className="font-bold text-indigo-400 shrink-0">{numMatch[1]}.</span>
          <div className="flex-1">{renderInlineFormatting(numMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p key={blockKey++} className="text-xs text-slate-300 leading-relaxed my-2">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  }

  if (inTable) {
    flushTable();
  }

  return <div className="space-y-1 font-body">{blocks}</div>;
}

/**
 * Parses inline formatting like **bold**, `code`, and currency highlights.
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Regex to match bold **text**, code `text`, and currency/percentages
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(highlightMetrics(text.substring(lastIdx, match.index)));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-white">
          {highlightMetrics(token.slice(2, -2))}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 text-[11px] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(highlightMetrics(text.substring(lastIdx)));
  }

  return parts;
}

function highlightMetrics(str: string): React.ReactNode {
  // Check for negative rupees like -₹67,628
  if (str.includes("-₹") || str.includes("- ₹")) {
    return <span className="text-rose-400 font-semibold">{str}</span>;
  }
  return str;
}

