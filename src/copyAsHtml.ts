import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
});

const STYLESHEET = `
body, div { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292e; }
code { font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace; background-color: rgba(27,31,35,0.05); padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow: auto; line-height: 1.45; }
pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: 100%; }
blockquote { border-left: 4px solid #dfe2e5; padding: 0 16px; color: #6a737d; margin: 0 0 16px 0; }
table { border-collapse: collapse; margin: 16px 0; }
table th, table td { border: 1px solid #dfe2e5; padding: 6px 13px; }
table th { font-weight: 600; background-color: #f6f8fa; }
img { max-width: 100%; }
h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
hr { border: none; border-top: 1px solid #e1e4e8; margin: 24px 0; }
a { color: #0366d6; text-decoration: none; }
`.trim();

export function markdownToHtml(markdown: string): string {
  let html = md.render(markdown);

  // Post-process: convert task list markers to checkboxes
  html = html.replace(
    /<li>\s*\[ \]\s*/g,
    '<li style="list-style:none;"><input type="checkbox" disabled> '
  );
  html = html.replace(
    /<li>\s*\[x\]\s*/gi,
    '<li style="list-style:none;"><input type="checkbox" disabled checked> '
  );

  return `<div><style>${STYLESHEET}</style>${html}</div>`;
}

export async function copyAsHtml(
  editor: vscode.TextEditor
): Promise<void> {
  const selection = editor.selection;
  let text: string;

  if (!selection.isEmpty) {
    text = editor.document.getText(selection);
  } else {
    // Match VS Code's default copy behavior: copy the current line when nothing is selected
    const line = editor.document.lineAt(selection.active.line);
    text = line.text;
  }

  if (!text.trim()) {
    // Nothing meaningful — fall through to default copy
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    return;
  }

  const html = markdownToHtml(text);

  try {
    await writeHtmlToClipboard(html, text);
    vscode.window.setStatusBarMessage('$(clippy) Copied as HTML', 2000);
  } catch {
    // Fallback: copy HTML as plain text
    await vscode.env.clipboard.writeText(html);
    vscode.window.showWarningMessage(
      'Copied HTML as text (rich clipboard not available on this platform).'
    );
  }
}

export async function copyFileAsHtml(uri: vscode.Uri): Promise<void> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = new TextDecoder().decode(bytes);

  if (!text.trim()) {
    vscode.window.showInformationMessage('File is empty.');
    return;
  }

  const html = markdownToHtml(text);

  try {
    await writeHtmlToClipboard(html, text);
    vscode.window.setStatusBarMessage('$(clippy) Copied as HTML', 2000);
  } catch {
    await vscode.env.clipboard.writeText(html);
    vscode.window.showWarningMessage(
      'Copied HTML as text (rich clipboard not available on this platform).'
    );
  }
}

async function writeHtmlToClipboard(
  html: string,
  plainText: string
): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return writeClipboardMac(html, plainText);
    case 'win32':
      return writeClipboardWindows(html, plainText);
    default:
      return writeClipboardLinux(html, plainText);
  }
}

// --- macOS: osascript with JXA + NSPasteboard ---

async function writeClipboardMac(
  html: string,
  plainText: string
): Promise<void> {
  const tmpDir = os.tmpdir();
  const id = `vsc-copyhtml-${process.pid}-${Date.now()}`;
  const htmlFile = path.join(tmpDir, `${id}.html`);
  const textFile = path.join(tmpDir, `${id}.txt`);
  const scriptFile = path.join(tmpDir, `${id}.js`);

  try {
    fs.writeFileSync(htmlFile, html, 'utf8');
    fs.writeFileSync(textFile, plainText, 'utf8');

    // JXA script that sets both text/html and text/plain on the pasteboard
    const script = [
      'ObjC.import("AppKit");',
      'ObjC.import("Foundation");',
      '',
      `var htmlPath = "${escapeJsString(htmlFile)}";`,
      `var textPath = "${escapeJsString(textFile)}";`,
      '',
      'var htmlStr = $.NSString.stringWithContentsOfFileEncodingError(htmlPath, $.NSUTF8StringEncoding, null);',
      'var htmlData = htmlStr.dataUsingEncoding($.NSUTF8StringEncoding);',
      'var textStr = $.NSString.stringWithContentsOfFileEncodingError(textPath, $.NSUTF8StringEncoding, null);',
      '',
      'var pb = $.NSPasteboard.generalPasteboard;',
      'pb.clearContents;',
      'pb.setDataForType(htmlData, $.NSPasteboardTypeHTML);',
      'pb.setStringForType(textStr, $.NSPasteboardTypeString);',
    ].join('\n');

    fs.writeFileSync(scriptFile, script, 'utf8');

    await execFileAsync('osascript', ['-l', 'JavaScript', scriptFile]);
  } finally {
    cleanupFiles(htmlFile, textFile, scriptFile);
  }
}

// --- Windows: PowerShell with .NET clipboard ---

async function writeClipboardWindows(
  html: string,
  plainText: string
): Promise<void> {
  const tmpDir = os.tmpdir();
  const id = `vsc-copyhtml-${process.pid}-${Date.now()}`;
  const cfHtmlFile = path.join(tmpDir, `${id}.cfhtml`);
  const textFile = path.join(tmpDir, `${id}.txt`);
  const scriptFile = path.join(tmpDir, `${id}.ps1`);

  try {
    fs.writeFileSync(cfHtmlFile, createCfHtml(html), 'utf8');
    fs.writeFileSync(textFile, plainText, 'utf8');

    const psScript = [
      'Add-Type -AssemblyName System.Windows.Forms',
      `$cfHtml = [System.IO.File]::ReadAllText("${escapePsString(cfHtmlFile)}")`,
      `$text = [System.IO.File]::ReadAllText("${escapePsString(textFile)}")`,
      '$dataObj = New-Object System.Windows.Forms.DataObject',
      '$dataObj.SetData([System.Windows.Forms.DataFormats]::Html, $cfHtml)',
      '$dataObj.SetData([System.Windows.Forms.DataFormats]::UnicodeText, $text)',
      '[System.Windows.Forms.Clipboard]::SetDataObject($dataObj, $true)',
    ].join('\r\n');

    fs.writeFileSync(scriptFile, psScript, 'utf8');

    await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Sta',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptFile,
    ]);
  } finally {
    cleanupFiles(cfHtmlFile, textFile, scriptFile);
  }
}

/**
 * Creates Windows CF_HTML clipboard format with required headers.
 * See: https://learn.microsoft.com/en-us/windows/win32/dataxchg/html-clipboard-format
 */
function createCfHtml(html: string): string {
  const header =
    'Version:0.9\r\n' +
    'StartHTML:0000000000\r\n' +
    'EndHTML:0000000000\r\n' +
    'StartFragment:0000000000\r\n' +
    'EndFragment:0000000000\r\n';

  const preamble = '<html><body>\r\n<!--StartFragment-->';
  const postamble = '<!--EndFragment-->\r\n</body></html>';

  const headerLen = Buffer.byteLength(header, 'utf8');
  const startHtml = headerLen;
  const startFragment = startHtml + Buffer.byteLength(preamble, 'utf8');
  const endFragment = startFragment + Buffer.byteLength(html, 'utf8');
  const endHtml = endFragment + Buffer.byteLength(postamble, 'utf8');

  return (
    'Version:0.9\r\n' +
    `StartHTML:${String(startHtml).padStart(10, '0')}\r\n` +
    `EndHTML:${String(endHtml).padStart(10, '0')}\r\n` +
    `StartFragment:${String(startFragment).padStart(10, '0')}\r\n` +
    `EndFragment:${String(endFragment).padStart(10, '0')}\r\n` +
    preamble +
    html +
    postamble
  );
}

// --- Linux: xclip or wl-copy ---

async function writeClipboardLinux(
  html: string,
  plainText: string
): Promise<void> {
  // Try xclip (X11)
  if (await trySpawnWrite('xclip', ['-selection', 'clipboard', '-t', 'text/html'], html)) {
    return;
  }

  // Try wl-copy (Wayland)
  if (await trySpawnWrite('wl-copy', ['--type', 'text/html'], html)) {
    return;
  }

  // No clipboard tool available — let the caller handle fallback
  throw new Error(
    'No HTML clipboard tool found. Install xclip (X11) or wl-copy (Wayland).'
  );
}

async function trySpawnWrite(
  command: string,
  args: string[],
  input: string
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const proc = cp.spawn(command, args, {
        stdio: ['pipe', 'ignore', 'ignore'],
      });

      proc.on('error', () => resolve(false));

      proc.stdin.write(input, () => {
        proc.stdin.end();
      });

      // xclip stays alive as clipboard owner; resolve once stdin is flushed
      proc.stdin.on('finish', () => resolve(true));

      // Safety timeout
      setTimeout(() => resolve(true), 2000);
    } catch {
      resolve(false);
    }
  });
}

// --- Utilities ---

function execFileAsync(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.execFile(command, args, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${command} failed: ${stderr || err.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

function cleanupFiles(...files: string[]): void {
  for (const file of files) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function escapeJsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapePsString(s: string): string {
  return s.replace(/\\/g, '\\\\');
}
