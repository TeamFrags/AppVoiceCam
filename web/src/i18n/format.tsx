import { Fragment, type ReactNode } from 'react';

/** Replaces {placeholders}. Unknown ones are left as they are, for a later pass. */
export function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}

/**
 * Turns the tagged parts of a translated sentence into elements, so a link or a bold word keeps
 * its place in each language: rich('Read <a>the page</a>.', { a: (text) => <Link …>{text}</Link> })
 */
export function rich(template: string, tags: Record<string, (text: string) => ReactNode>) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of template.matchAll(/<(\w+)>(.*?)<\/\1>/g)) {
    const [whole, tag = '', text = ''] = match;
    parts.push(template.slice(last, match.index));
    parts.push(<Fragment key={match.index}>{tags[tag]?.(text) ?? text}</Fragment>);
    last = match.index + whole.length;
  }
  parts.push(template.slice(last));
  return parts;
}
