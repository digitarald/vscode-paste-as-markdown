import { cleanHtml, promoteTableHeaders } from "../htmlCleaner";
import { htmlToMarkdown, isTrivialHtml, detectLanguage } from "../markdownConverter";
import {
  isInsideFencedCodeBlock,
  isInsideMathBlock,
  isInsideInlineCode,
} from "../smartPaste";
import assert from "node:assert";
import { describe, it } from "node:test";

// ─── cleanHtml tests ──────────────────────────────────────────

describe("cleanHtml", () => {
  it("strips Word conditional comments", () => {
    const input = `<p>Hello</p><!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--><p>World</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("<!--[if"));
    assert.ok(!result.includes("<![endif]-->"));
    assert.ok(result.includes("<p>Hello</p>"));
    assert.ok(result.includes("<p>World</p>"));
  });

  it("strips HTML comments", () => {
    const input = `<p>Before</p><!-- a comment --><p>After</p>`;
    assert.ok(!cleanHtml(input).includes("<!--"));
  });

  it("strips Office XML namespace tags", () => {
    const input = `<p>Text</p><o:p>&nbsp;</o:p><w:Sdt>stuff</w:Sdt>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("<o:p>"));
    assert.ok(!result.includes("<w:Sdt>"));
  });

  it("strips Mso class attributes", () => {
    const input = `<p class="MsoNormal">Hello</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("MsoNormal"));
    assert.ok(result.includes("<p>Hello</p>"));
  });

  it("strips mso- style attributes", () => {
    const input = `<p style="mso-bidi-font-family: Arial; color: red;">Text</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("mso-"));
  });

  it("removes empty spans and paragraphs", () => {
    const input = `<span class="foo"> </span><p class="MsoNormal">&nbsp;</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("<span"));
    assert.ok(!result.includes("<p"));
  });

  it("normalizes &nbsp;", () => {
    const input = `<p>Hello&nbsp;World</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("&nbsp;"));
    assert.ok(result.includes("Hello World"));
  });

  it("collapses excessive <br> tags", () => {
    const input = `<p>A</p><br><br><br><br><br><p>B</p>`;
    const result = cleanHtml(input);
    // Should have at most 2 <br>
    const brCount = (result.match(/<br>/gi) || []).length;
    assert.ok(brCount <= 2, `Expected <= 2 <br>, got ${brCount}`);
  });

  it("strips zero-width characters", () => {
    const input = `<p>Hello\u200BWorld\uFEFF</p>`;
    const result = cleanHtml(input);
    assert.ok(!result.includes("\u200B"));
    assert.ok(!result.includes("\uFEFF"));
  });
});

// ─── isTrivialHtml tests ──────────────────────────────────────

describe("isTrivialHtml", () => {
  it("returns true for plain text in a single <span>", () => {
    assert.ok(isTrivialHtml("<span>Hello World</span>"));
  });

  it("returns true for plain text in a single <p>", () => {
    assert.ok(isTrivialHtml("<p>Just some text</p>"));
  });

  it("returns true with fragment markers", () => {
    assert.ok(
      isTrivialHtml("<!--StartFragment--><span>text</span><!--EndFragment-->")
    );
  });

  it("returns false for HTML with bold", () => {
    assert.ok(!isTrivialHtml("<p>Hello <strong>World</strong></p>"));
  });

  it("returns false for HTML with links", () => {
    assert.ok(!isTrivialHtml('<p><a href="url">link</a></p>'));
  });

  it("returns false for HTML with multiple elements", () => {
    assert.ok(!isTrivialHtml("<p>One</p><p>Two</p>"));
  });
});

// ─── Full pipeline tests ──────────────────────────────────────

describe("htmlToMarkdown", () => {
  it("converts basic formatting", () => {
    const html = `<p>This is <strong>bold</strong> and <em>italic</em> text.</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("**bold**"), `Expected **bold** in: ${md}`);
    assert.ok(md.includes("*italic*"), `Expected *italic* in: ${md}`);
  });

  it("converts headings", () => {
    const html = `<h1>Title</h1><h2>Subtitle</h2><p>Body</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("# Title"), `Expected # Title in: ${md}`);
    assert.ok(md.includes("## Subtitle"), `Expected ## Subtitle in: ${md}`);
  });

  it("converts links", () => {
    const html = `<p>Check <a href="https://example.com">this link</a>.</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("[this link](https://example.com)"),
      `Expected markdown link in: ${md}`
    );
  });

  it("converts unordered lists", () => {
    const html = `<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("Apple"), `Expected Apple in: ${md}`);
    assert.ok(md.includes("Banana"), `Expected Banana in: ${md}`);
    assert.ok(md.includes("-"), `Expected - bullet in: ${md}`);
  });

  it("converts ordered lists", () => {
    const html = `<ol><li>First</li><li>Second</li><li>Third</li></ol>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("1."), `Expected numbered list in: ${md}`);
  });

  it("converts tables to GFM", () => {
    const html = `
      <table>
        <thead><tr><th>Name</th><th>Age</th></tr></thead>
        <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
      </table>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("| Name"), `Expected table header in: ${md}`);
    assert.ok(md.includes("| Alice"), `Expected table row in: ${md}`);
    assert.ok(md.includes("---"), `Expected separator in: ${md}`);
  });

  it("converts strikethrough", () => {
    const html = `<p>This is <del>deleted</del> text.</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("~deleted~"), `Expected ~deleted~ in: ${md}`);
  });

  it("converts images", () => {
    const html = `<img src="https://example.com/img.png" alt="A photo">`;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("![A photo](https://example.com/img.png)"),
      `Expected image syntax in: ${md}`
    );
  });

  it("strips script and style tags", () => {
    const html = `<p>Text</p><script>alert('xss')</script><style>body{}</style>`;
    const md = htmlToMarkdown(html);
    assert.ok(!md.includes("alert"), `Expected no script in: ${md}`);
    assert.ok(!md.includes("body{}"), `Expected no style in: ${md}`);
  });

  it("handles messy Word HTML", () => {
    const html = `
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->
      <p class="MsoNormal" style="mso-bidi-font-family: 'Times New Roman';">
        <b><span style="font-size:14.0pt;mso-bidi-font-size:12.0pt">Important Title</span></b>
      </p>
      <p class="MsoListParagraph" style="text-indent:-.25in;mso-list:l0 level1 lfo1">
        <span style="mso-list:Ignore">·<span style="font:7.0pt 'Times New Roman'">&nbsp;&nbsp;&nbsp;</span></span>
        First item
      </p>
      <p class="MsoNormal"><o:p>&nbsp;</o:p></p>
    `;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("Important Title"),
      `Expected title in: ${md}`
    );
    assert.ok(!md.includes("mso-"), `Expected no mso- in: ${md}`);
    assert.ok(!md.includes("MsoNormal"), `Expected no MsoNormal in: ${md}`);
    assert.ok(
      !md.includes("<!--[if"),
      `Expected no conditional comments in: ${md}`
    );
  });

  it("handles Chrome web page copy", () => {
    const html = `<!--StartFragment--><h2>Getting Started</h2>
<p>Follow these steps to <strong>install</strong> the package:</p>
<ol>
<li>Run <code>npm install</code></li>
<li>Configure your <a href="https://example.com/docs">settings</a></li>
</ol><!--EndFragment-->`;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("## Getting Started"),
      `Expected heading in: ${md}`
    );
    assert.ok(md.includes("**install**"), `Expected bold in: ${md}`);
    assert.ok(
      md.includes("`npm install`"),
      `Expected inline code in: ${md}`
    );
    assert.ok(
      md.includes("[settings](https://example.com/docs)"),
      `Expected link in: ${md}`
    );
  });

  it("collapses excessive blank lines", () => {
    const html = `<p>Line 1</p><br><br><br><br><br><p>Line 2</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("Line 1"), `Expected Line 1 in: ${md}`);
    assert.ok(md.includes("Line 2"), `Expected Line 2 in: ${md}`);
    // Verify no runs of 4+ consecutive newlines
    assert.ok(
      !md.includes("\n\n\n\n"),
      `Expected no 4+ consecutive newlines in: ${JSON.stringify(md)}`
    );
  });

  it("converts <mark> to ==highlight==", () => {
    const html = `<p>This is <mark>highlighted</mark> text.</p>`;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("==highlighted=="),
      `Expected ==highlighted== in: ${md}`
    );
  });

  it("converts task lists", () => {
    const html = `<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("[x]"), `Expected [x] in: ${md}`);
    assert.ok(md.includes("[ ]"), `Expected [ ] in: ${md}`);
  });

  it("unwraps Google Docs redirect URLs", () => {
    const html = `<p><a href="https://www.google.com/url?q=https://example.com/page&amp;sa=D&amp;source=docs">link</a></p>`;
    const md = htmlToMarkdown(html);
    assert.ok(
      md.includes("[link](https://example.com/page)"),
      `Expected unwrapped URL in: ${md}`
    );
    assert.ok(
      !md.includes("google.com/url"),
      `Expected no Google redirect in: ${md}`
    );
  });

  it("converts tables without <thead>", () => {
    const html = `<table><tr><td>Name</td><td>Age</td></tr><tr><td>Bob</td><td>25</td></tr></table>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("Name"), `Expected Name in: ${md}`);
    assert.ok(md.includes("Bob"), `Expected Bob in: ${md}`);
    assert.ok(md.includes("|"), `Expected pipe table syntax in: ${md}`);
    assert.ok(md.includes("---"), `Expected separator in: ${md}`);
  });

  it("handles Google Docs HTML", () => {
    const html = `<b style="font-weight:normal" id="docs-internal-guid-abc123"><span dir="ltr">Hello </span><span dir="ltr"><a href="https://www.google.com/url?q=https://example.com&amp;sa=D">example</a></span></b>`;
    const md = htmlToMarkdown(html);
    assert.ok(md.includes("Hello"), `Expected Hello in: ${md}`);
    assert.ok(
      md.includes("[example](https://example.com)"),
      `Expected clean link in: ${md}`
    );
    assert.ok(
      !md.includes("docs-internal-guid"),
      `Expected no Google GUID in: ${md}`
    );
    assert.ok(!md.includes("**Hello"), `Expected no fake bold in: ${md}`);
  });

  it("strips data-* attributes", () => {
    const input = `<p data-block-id="abc123" data-pm-slice="1 1 []">Hello <strong data-bold="true">World</strong></p>`;
    const md = htmlToMarkdown(input);
    assert.ok(md.includes("**World**"), `Expected bold in: ${md}`);
    assert.ok(!md.includes("data-"), `Expected no data attrs in: ${md}`);
  });

  it("strips fragment markers from conversion", () => {
    const html = `<!--StartFragment--><p>Clean <strong>content</strong></p><!--EndFragment-->`;
    const md = htmlToMarkdown(html);
    assert.ok(!md.includes("Fragment"), `Expected no fragment markers in: ${md}`);
    assert.ok(md.includes("**content**"), `Expected bold in: ${md}`);
  });
});

// ─── Smart context detection tests ────────────────────────────

describe("isInsideFencedCodeBlock", () => {
  it("returns false for normal text", () => {
    const text = "# Hello\n\nSome text here";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), false);
  });

  it("returns true inside a fenced code block", () => {
    const text = "# Hello\n\n```js\nconst x = 1;\n";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), true);
  });

  it("returns false after a closed code block", () => {
    const text = "```js\nconst x = 1;\n```\n\nNormal text";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), false);
  });

  it("returns true inside a tilde code block", () => {
    const text = "~~~python\nimport os\n";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), true);
  });

  it("returns false after a closed tilde block", () => {
    const text = "~~~\ncode\n~~~\ntext";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), false);
  });

  it("returns false when backticks appear mid-line (not a fence)", () => {
    const text = "Use `code` in text";
    assert.strictEqual(isInsideFencedCodeBlock(text, text.length), false);
  });
});

describe("isInsideMathBlock", () => {
  it("returns false for normal text", () => {
    const text = "Some text with $inline$ math";
    assert.strictEqual(isInsideMathBlock(text, text.length), false);
  });

  it("returns true inside a $$ math block", () => {
    const text = "Text\n\n$$\nx = y + z\n";
    assert.strictEqual(isInsideMathBlock(text, text.length), true);
  });

  it("returns false after a closed $$ block", () => {
    const text = "$$\nx = y\n$$\n\nMore text";
    assert.strictEqual(isInsideMathBlock(text, text.length), false);
  });
});

describe("isInsideInlineCode", () => {
  it("returns false for normal text", () => {
    assert.strictEqual(isInsideInlineCode("normal text here", 5), false);
  });

  it("returns true between backticks", () => {
    assert.strictEqual(isInsideInlineCode("text `code here` after", 10), true);
  });

  it("returns false after closed inline code", () => {
    assert.strictEqual(isInsideInlineCode("text `code` after", 15), false);
  });

  it("returns true with double backticks", () => {
    assert.strictEqual(isInsideInlineCode("text ``code here`` after", 11), true);
  });

  it("returns false outside double backticks", () => {
    assert.strictEqual(isInsideInlineCode("text ``code`` after", 17), false);
  });
});

// ─── detectLanguage tests ─────────────────────────────────────

describe("detectLanguage", () => {
  const el = (className: string) =>
    ({ className, getAttribute: () => null }) as any;

  it("detects language- prefix", () => {
    assert.strictEqual(detectLanguage(el("language-javascript")), "javascript");
  });

  it("detects lang- prefix", () => {
    assert.strictEqual(detectLanguage(el("lang-typescript")), "typescript");
  });

  it("detects highlight-source- prefix", () => {
    assert.strictEqual(
      detectLanguage(el("highlight-source-python")),
      "python"
    );
  });

  it("detects brush: prefix", () => {
    assert.strictEqual(detectLanguage(el("brush: java")), "java");
  });

  it("detects code- prefix", () => {
    assert.strictEqual(detectLanguage(el("code-ruby")), "ruby");
  });

  it("handles c++ language", () => {
    assert.strictEqual(detectLanguage(el("language-c++")), "c++");
  });

  it("handles c# language", () => {
    assert.strictEqual(detectLanguage(el("language-c#")), "c#");
  });

  it("handles objective-c with hyphen", () => {
    assert.strictEqual(
      detectLanguage(el("language-objective-c")),
      "objective-c"
    );
  });

  it("returns empty string for no class", () => {
    assert.strictEqual(detectLanguage(el("")), "");
  });

  it("returns empty string for unrecognized class", () => {
    assert.strictEqual(detectLanguage(el("something-random")), "");
  });

  it("uses getAttribute when available", () => {
    const element = { getAttribute: () => "language-go", className: "" } as any;
    assert.strictEqual(detectLanguage(element), "go");
  });
});

// ─── promoteTableHeaders tests ────────────────────────────────

describe("promoteTableHeaders", () => {
  it("promotes first row to thead when none exists", () => {
    const html =
      "<table><tr><td>Name</td><td>Age</td></tr><tr><td>Alice</td><td>30</td></tr></table>";
    const result = promoteTableHeaders(html);
    assert.ok(result.includes("<thead>"), "should add <thead>");
    assert.ok(result.includes("<th>Name</th>"), "should promote td to th");
    assert.ok(result.includes("<th>Age</th>"), "should promote td to th");
  });

  it("does not modify table that already has thead", () => {
    const html =
      "<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Alice</td></tr></tbody></table>";
    const result = promoteTableHeaders(html);
    assert.strictEqual(result, html);
  });

  it("promotes first row from tbody when no thead", () => {
    const html =
      "<table><tbody><tr><td>Col1</td><td>Col2</td></tr><tr><td>V1</td><td>V2</td></tr></tbody></table>";
    const result = promoteTableHeaders(html);
    assert.ok(result.includes("<thead>"), "should add thead");
    assert.ok(result.includes("<th>Col1</th>"), "should promote to th");
  });

  it("handles table with attributes", () => {
    const html = '<table class="data"><tr><td>A</td></tr></table>';
    const result = promoteTableHeaders(html);
    assert.ok(
      result.includes('<table class="data">'),
      "should keep table attributes"
    );
    assert.ok(result.includes("<thead>"), "should add thead");
  });
});
