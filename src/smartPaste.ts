/**
 * Smart context detection for paste operations.
 * Determines whether HTML-to-markdown conversion should be applied based on
 * the cursor position in the document — matching the built-in markdown
 * extension's smart paste behavior (smartDropOrPaste.ts).
 *
 * Skips conversion when the cursor is inside:
 * - Fenced code blocks (``` or ~~~)
 * - Display math blocks ($$...$$)
 * - Inline code spans (`...`)
 */

/** Check if offset falls inside a fenced code block (``` ... ```) */
export function isInsideFencedCodeBlock(
  text: string,
  offset: number
): boolean {
  const before = text.slice(0, offset);
  // Match lines that start with 3+ backticks or tildes (fence openers/closers)
  const fences = before.match(/^(?:`{3,}|~{3,})/gm);
  // Odd count means we're inside an unclosed fence
  return fences !== null && fences.length % 2 !== 0;
}

/** Check if offset falls inside a display math block ($$ ... $$) */
export function isInsideMathBlock(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  const delimiters = before.match(/\$\$/g);
  return delimiters !== null && delimiters.length % 2 !== 0;
}

/** Check if character position falls inside inline code (`...`) on a single line */
export function isInsideInlineCode(
  line: string,
  character: number
): boolean {
  let inside = false;
  for (let i = 0; i < character && i < line.length; i++) {
    if (line[i] === "`") {
      // Skip multi-backtick sequences (`` ... ``)
      let count = 0;
      while (i < line.length && line[i] === "`") {
        count++;
        i++;
      }
      // Find matching closing backtick sequence of same length
      const closer = "`".repeat(count);
      const closerIdx = line.indexOf(closer, i);
      if (closerIdx !== -1 && closerIdx < character) {
        // Entire inline code span is before cursor
        i = closerIdx + count - 1;
      } else if (closerIdx === -1 || closerIdx >= character) {
        // Cursor is inside this inline code span
        inside = true;
      }
    }
  }
  return inside;
}
