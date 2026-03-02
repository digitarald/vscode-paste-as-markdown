/**
 * Pre-processes HTML to strip Microsoft Word / Office bloat,
 * Google Docs artifacts, and other app-specific noise
 * before passing to Turndown for Markdown conversion.
 */

/** Browser clipboard fragment markers */
const FRAGMENT_MARKERS = /<!--(?:Start|End)Fragment-->/g;

/** Remove Word conditional comments: <!--[if ...]>...<![endif]--> */
const CONDITIONAL_COMMENTS = /<!--\[if\s[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi;

/** Remove all HTML comments */
const HTML_COMMENTS = /<!--[\s\S]*?-->/g;

/** Remove Office XML namespace tags: <o:p>, </o:p>, <w:Sdt>, etc. */
const OFFICE_XML_TAGS = /<\/?(?:o|w|m|v|st\d):[^>]*>/gi;

/** Remove class="Mso..." attributes */
const MSO_CLASS = /\s*class\s*=\s*(?:"[^"]*Mso[^"]*"|'[^']*Mso[^']*')/gi;

/** Remove style attributes containing mso- properties */
const MSO_STYLE = /\s*style\s*=\s*(?:"[^"]*mso-[^"]*"|'[^']*mso-[^']*')/gi;

/** Remove all remaining inline style attributes (aggressive but clean) */
const ALL_STYLES = /\s*style\s*=\s*(?:"[^"]*"|'[^']*')/gi;

/** Remove empty spans: <span> </span>, <span></span> (preserves newlines for <pre> blocks) */
const EMPTY_SPANS = /<span[^>]*>[^\S\n]*<\/span>/gi;

/** Remove empty paragraphs */
const EMPTY_PARAGRAPHS = /<p[^>]*>\s*(?:&nbsp;\s*)*<\/p>/gi;

/** Normalize non-breaking spaces */
const NBSP = /&nbsp;/g;

/** Collapse <br> sequences (3+ in a row) */
const EXCESSIVE_BR = /(?:\s*<br\s*\/?>\s*){3,}/gi;

/** Zero-width characters from Word */
const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/g;

/** XML processing instructions <?xml ...?> */
const XML_PI = /<\?xml[^?]*\?>/gi;

/** <xml>...</xml> blocks (Word inserts these) */
const XML_BLOCKS = /<xml>[\s\S]*?<\/xml>/gi;

/** Google Docs internal GUID wrapper ids */
const GDOCS_GUID = /\s*id\s*=\s*"docs-internal-guid-[^"]*"/gi;

/** dir="ltr" / dir="rtl" attributes (Google Docs noise) */
const DIR_ATTR = /\s*dir\s*=\s*"(?:ltr|rtl)"/gi;

/** Google Docs non-semantic bold: <b style="...font-weight:normal..."> → unwrap */
const GDOCS_FAKE_BOLD = /<b\s[^>]*?style\s*=\s*"[^"]*font-weight:\s*normal[^"]*"[^>]*>([\s\S]*?)<\/b>/gi;

/** Span/font with font-weight:bold or font-weight:700-900 → <strong> */
const INLINE_BOLD =
  /<(span|font)\b([^>]*?)style\s*=\s*"([^"]*?)font-weight:\s*(?:bold|[7-9]00)([^"]*?)"([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Span/font with font-style:italic → <em> */
const INLINE_ITALIC =
  /<(span|font)\b([^>]*?)style\s*=\s*"([^"]*?)font-style:\s*italic([^"]*?)"([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Span/font with text-decoration containing line-through → <s> */
const INLINE_STRIKETHROUGH =
  /<(span|font)\b([^>]*?)style\s*=\s*"([^"]*?)text-decoration:\s*[^"]*line-through([^"]*?)"([^>]*)>([\s\S]*?)<\/\1>/gi;

/** Span/font with monospace font-family → <code> */
const INLINE_CODE =
  /<(span|font)\b([^>]*?)style\s*=\s*"([^"]*?)font-family:\s*[^"]*?(?:Courier|Consolas|monospace|'Courier New')[^"]*?"([^>]*)>([\s\S]*?)<\/\1>/gi;

/** data-* attributes from Notion, Confluence, Slack, etc. */
const DATA_ATTRS = /\s*data-[a-z][a-z0-9-]*\s*=\s*"[^"]*"/gi;

// --- Twitter/X Article patterns ---

/** Detect Twitter/X article HTML by data-testid markers */
const TWITTER_DETECT = /data-testid="(?:twitter-article-title|twitterArticleRichTextView|longformRichTextComponent)"/;

/** Style attributes containing Tailwind CSS variables (massive bloat) */
const TAILWIND_STYLES = /\s*style\s*=\s*"[^"]*--tw-[^"]*"/gi;

/** Twitter article title div → unwrap to <h1> */
const TWITTER_TITLE = /<div[^>]*data-testid\s*=\s*"twitter-article-title"[^>]*>([\s\S]*?)<\/div>/i;

/** Twitter engagement bar (replies, reposts, likes, etc.) */
const TWITTER_ENGAGEMENT = /<div[^>]*aria-label\s*=\s*"[^"]*(?:repl(?:y|ies)|repost|like|bookmark|view)[^"]*"[^>]*role\s*=\s*"group"[^>]*>[\s\S]*?<\/div>\s*<\/div>/i;

/** Twitter code block language label: <div ...><div dir="ltr"><span>lang</span></div><div></div></div><pre> */
const TWITTER_CODE_LANG = /<div[^>]*data-testid\s*=\s*"markdown-code-block"[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<span[^>]*>(\w+)<\/span>\s*<\/div>\s*(?:<div[^>]*>\s*<\/div>\s*)?\s*<\/div>\s*<pre[^>]*>\s*<code/gi;

/**
 * Cleans messy HTML (especially from Word/Office) into simple,
 * standards-compliant HTML that Turndown can handle well.
 */
export function cleanHtml(html: string): string {
  let result = html
    // Strip clipboard fragment markers first
    .replace(FRAGMENT_MARKERS, "");

  // Twitter/X article: strip Tailwind bloat and fix structure early
  if (TWITTER_DETECT.test(result)) {
    result = cleanTwitterHtml(result);
  }

  result = result
    // Remove XML processing instructions and blocks
    .replace(XML_PI, "")
    .replace(XML_BLOCKS, "")
    // Remove Word conditional comments first (they can contain markup)
    .replace(CONDITIONAL_COMMENTS, "")
    // Remove remaining HTML comments
    .replace(HTML_COMMENTS, "")
    // Remove Office namespace tags
    .replace(OFFICE_XML_TAGS, "")
    // Remove Mso class attributes
    .replace(MSO_CLASS, "")
    // Remove style attributes with mso- properties
    .replace(MSO_STYLE, "")
    // Google Docs: unwrap non-semantic <b> BEFORE stripping all styles
    .replace(GDOCS_FAKE_BOLD, "$1");

  // Convert inline-styled formatting to semantic tags before stripping styles.
  // Google Docs uses <span style="font-weight:bold"> instead of <strong>, etc.
  // Run multiple passes since a single element can have bold+italic.
  result = promotInlineStylesToTags(result);

  result = result
    // Remove all remaining inline styles for clean output
    .replace(ALL_STYLES, "")
    // Google Docs cleanup
    .replace(GDOCS_GUID, "")
    .replace(DIR_ATTR, "")
    // Strip data-* attributes (Notion, Confluence, Slack)
    .replace(DATA_ATTRS, "")
    // Clean up empty elements left behind
    .replace(EMPTY_SPANS, "")
    .replace(EMPTY_PARAGRAPHS, "")
    // Normalize spaces
    .replace(NBSP, " ")
    .replace(ZERO_WIDTH, "")
    // Collapse excessive <br> tags
    .replace(EXCESSIVE_BR, "<br><br>");

  // Promote first <tr> to <thead> in tables that lack one
  result = promoteTableHeaders(result);

  return result;
}

/**
 * Pre-process Twitter/X article HTML:
 * - Strip massive Tailwind CSS variable bloat from style attributes
 * - Promote article title to <h1>
 * - Remove engagement metrics bar
 * - Wire code block language labels into <code class="language-X">
 */
function cleanTwitterHtml(html: string): string {
  let result = html
    // Strip Tailwind CSS variable bloat (can be 90%+ of clipboard size)
    .replace(TAILWIND_STYLES, "");

  // Promote article title div to <h1>
  result = result.replace(TWITTER_TITLE, (_m, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    return text ? `<h1>${text}</h1>` : "";
  });

  // Remove engagement metrics bar (replies, reposts, likes, etc.)
  result = result.replace(TWITTER_ENGAGEMENT, "");

  // Move code block language labels into <code class="language-X">
  result = result.replace(TWITTER_CODE_LANG, (_m, lang) => {
    const normalizedLang = lang.toLowerCase() === "plaintext" ? "" : lang.toLowerCase();
    const cls = normalizedLang ? ` class="language-${normalizedLang}"` : "";
    return `<pre><code${cls}`;
  });

  // Unwrap block elements (<div>) inside headings — Turndown cannot convert
  // headings that contain block-level children
  result = result.replace(
    /<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_m, tag, attrs, inner) => {
      const unwrapped = inner
        .replace(/<div[^>]*>/gi, "")
        .replace(/<\/div>/gi, "");
      return `<${tag}${attrs}>${unwrapped}</${tag}>`;
    }
  );

  return result;
}

/**
 * Convert inline-styled spans (Google Docs pattern) to semantic HTML tags.
 * Handles bold, italic, strikethrough, and monospace code.
 * Runs each pattern in a loop to handle nested formatting.
 */
function promotInlineStylesToTags(html: string): string {
  let result = html;

  // Bold: <span style="...font-weight:bold..."> → <strong>...</strong>
  result = result.replace(INLINE_BOLD, (_m, _tag, _pre, _s1, _s2, _post, content) =>
    `<strong>${content}</strong>`);

  // Italic: <span style="...font-style:italic..."> → <em>...</em>
  result = result.replace(INLINE_ITALIC, (_m, _tag, _pre, _s1, _s2, _post, content) =>
    `<em>${content}</em>`);

  // Strikethrough: <span style="...line-through..."> → <s>...</s>
  result = result.replace(INLINE_STRIKETHROUGH, (_m, _tag, _pre, _s1, _s2, _post, content) =>
    `<s>${content}</s>`);

  // Code: <span style="...font-family:Courier..."> → <code>...</code>
  result = result.replace(INLINE_CODE, (_m, _tag, _pre, _s1, _post, content) =>
    `<code>${content}</code>`);

  return result;
}

/**
 * Find <table> elements without <thead> and promote their first <tr> to a header row.
 * The GFM table plugin requires <thead> to produce Markdown tables.
 */
export function promoteTableHeaders(html: string): string {
  return html.replace(
    /<table([^>]*)>\s*(?:<tbody[^>]*>)?\s*(<tr[\s\S]*?<\/tr>)/gi,
    (match, tableAttrs, firstRow) => {
      // Skip if there's already a <thead>
      if (/<thead/i.test(match)) return match;
      // Convert <td> to <th> in the first row
      const headerRow = firstRow
        .replace(/<td([^>]*)>/gi, "<th$1>")
        .replace(/<\/td>/gi, "</th>");
      const hadTbody = /<tbody/i.test(match);
      const remaining = match
        .replace(firstRow, "")
        .replace(/<table[^>]*>\s*(?:<tbody[^>]*>)?/i, "");
      if (hadTbody) {
        return `<table${tableAttrs}><thead>${headerRow}</thead><tbody>${remaining}`;
      }
      return `<table${tableAttrs}><thead>${headerRow}</thead><tbody>${remaining}</tbody></table>`;
    }
  );
}
