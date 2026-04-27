/**
 * Reflows common definition-card backs to save vertical space:
 * merges a leading "📖 <word>" line into the following bare "🇨🇦 English:" line
 * → "🇨🇦 English: <word>" so the headword sits beside the English label.
 */
export function compactCardBackDisplay(back: string): string {
  if (!back || typeof back !== 'string') {
    return '';
  }
  const normalized = back.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length < 2) {
    return back;
  }

  let i = 0;
  while (i < lines.length && lines[i].trim() === '') {
    i++;
  }
  if (i >= lines.length) {
    return back;
  }

  const first = lines[i].trim();
  const book = first.match(/^📖\s*(.+)$/u);
  if (!book) {
    return back;
  }

  const title = book[1].trim();
  if (!title || title.length > 120) {
    return back;
  }

  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') {
    j++;
  }
  if (j >= lines.length) {
    return back;
  }

  const second = lines[j].trim();
  if (!/^🇨🇦\s*English:\s*$/iu.test(second)) {
    return back;
  }

  const before = lines.slice(0, i);
  const after = lines.slice(j + 1);
  const merged = `🇨🇦 English: ${title}`;
  return [...before, merged, ...after].join('\n');
}
