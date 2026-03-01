/**
 * Converts cleaned HTML to Markdown using Turndown with GFM support.
 */

import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { cleanHtml } from "./htmlCleaner";

/** Collapse 3+ consecutive blank lines to 2 */
const EXCESSIVE_BLANK_LINES = /(?:\n[ \t]*){3,}/g;

/** Trailing whitespace per line */
const TRAILING_WHITESPACE = /[^\S\n]+$/gm;

/** Google Docs redirect URL wrapper */
const GOOGLE_REDIRECT_URL =
  /https?:\/\/(?:www\.)?google\.com\/url\?[^\s)]*?q=(https?[^&\s)]+)[^\s)]*/g;

let turndownService: TurndownService | undefined;

function getTurndown(): TurndownService {
  if (turndownService) {
    return turndownService;
  }

  turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
  });

  // Enable GFM: tables, task lists, strikethrough
  turndownService.use(gfm);

  // Remove non-content and potentially dangerous elements
  turndownService.remove([
    "script", "style", "meta", "link", "head",
    "iframe", "object", "embed", "applet",
    "form", "textarea", "select", "button",
    "svg", "canvas", "noscript",
  ]);

  // Custom rule: <mark> → ==highlight== (extended Markdown syntax)
  turndownService.addRule("highlight", {
    filter: "mark",
    replacement(content) {
      return content ? `==${content}==` : "";
    },
  });

  // Custom rule: detect language in code blocks from class names
  turndownService.addRule("fencedCodeBlock", {
    filter(node) {
      return (
        node.nodeName === "PRE" &&
        node.firstChild !== null &&
        node.firstChild.nodeName === "CODE"
      );
    },
    replacement(_content, node) {
      const codeNode = node.firstChild as HTMLElement;
      const code = codeNode.textContent || "";
      const lang = detectLanguage(codeNode);
      // Use longer fence or tildes if content contains triple backticks
      const fence = code.includes("```") ? "~~~~" : "```";
      return `\n\n${fence}${lang}\n${code.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });

  return turndownService;
}

/**
 * Detect programming language from class names on code/pre elements.
 * Common patterns: "language-js", "highlight-source-python", "lang-typescript"
 */
export function detectLanguage(el: HTMLElement): string {
  const className = el.getAttribute?.("class") || el.className || "";
  if (!className) return "";

  // Match common patterns ([\w+#.-]+ covers c++, c#, f#, objective-c)
  const patterns = [
    /language-([\w+#.-]+)/,
    /lang-([\w+#.-]+)/,
    /highlight-source-([\w+#.-]+)/,
    /brush:\s*([\w+#.-]+)/,
    /code-([\w+#.-]+)/,
  ];

  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match) return match[1];
  }

  return "";
}

/**
 * Post-process Markdown output to clean up artifacts.
 */
function cleanMarkdown(md: string): string {
  return md
    .replace(EXCESSIVE_BLANK_LINES, "\n\n")
    .replace(TRAILING_WHITESPACE, "")
    // Unwrap Google Docs redirect URLs
    .replace(GOOGLE_REDIRECT_URL, (_match, url) => {
      try {
        const decoded = decodeURIComponent(url);
        const parsed = new URL(decoded);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return url;
        }
        return decoded;
      } catch {
        return url;
      }
    })
    .trim();
}

/**
 * Full pipeline: raw HTML → clean HTML → Markdown → clean Markdown.
 */
export function htmlToMarkdown(html: string): string {
  const cleaned = cleanHtml(html);
  const td = getTurndown();
  try {
    const raw = td.turndown(cleaned);
    return cleanMarkdown(raw);
  } catch {
    return '';
  }
}

/**
 * Check whether the HTML is trivial (just plain text with no meaningful formatting).
 * If so, we should let VS Code paste as plain text instead.
 */
export function isTrivialHtml(html: string): boolean {
  // Strip the outer fragment markers that browsers add
  const stripped = html
    .replace(/^<!--StartFragment-->/, "")
    .replace(/<!--EndFragment-->$/, "")
    .trim();

  // If it's just a single <span> or <p> with no other tags inside, it's trivial
  const inner = stripped
    .replace(/^<(?:span|p|div)[^>]*>([\s\S]*)<\/(?:span|p|div)>$/i, "$1")
    .trim();

  // Check if the inner content has any HTML tags
  return !/<[a-z][^>]*>/i.test(inner);
}
