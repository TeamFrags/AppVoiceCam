import type { CSSProperties } from 'react';

type Look = 'plain' | 'ears' | 'hair' | 'cap';

// Colours come from the brand tokens, so the drawing follows a change of palette.
const TONES: Record<Look, { skin: string; body: string }> = {
  plain: { skin: 'var(--brand-haze)', body: 'var(--brand-line)' },
  ears: { skin: 'var(--brand-ember)', body: 'var(--brand-ember-deep)' },
  hair: { skin: 'var(--brand-cream)', body: 'var(--brand-spirit)' },
  cap: { skin: 'var(--brand-foxfire)', body: 'var(--brand-ink-raised)' },
};

function Avatar({ look }: { look: Look }) {
  const { skin, body } = TONES[look];
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true">
      {look === 'hair' && (
        <path d="M58 118V62a42 42 0 0 1 84 0v56h-18V66H76v52Z" fill="var(--brand-spirit)" />
      )}
      {look === 'ears' && <path d="M70 46 64 10l32 20ZM130 46l6-36-32 20Z" fill={skin} />}
      <path d="M38 150c5-32 28-46 62-46s57 14 62 46Z" fill={body} />
      <circle cx="100" cy="66" r="34" fill={skin} />
      {look === 'cap' && <path d="M66 58a34 34 0 0 1 68 0h22v10H66Z" fill="var(--brand-spirit)" />}
      <g fill="var(--brand-night)">
        <circle cx="88" cy="66" r="4" />
        <circle cx="112" cy="66" r="4" />
      </g>
      <path
        d="M88 80q12 10 24 0"
        fill="none"
        stroke="var(--brand-night)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const BAR_HEIGHTS = [30, 55, 80, 45, 95, 60, 35, 75, 100, 50, 70, 40, 85, 55, 30];

function Bars() {
  return (
    <div className="bars">
      {BAR_HEIGHTS.map((height, i) => (
        <i key={i} style={{ '--h': `${height}%`, '--i': i } as CSSProperties} />
      ))}
    </div>
  );
}

/** Before/after picture of what the application does. A drawing, not real output. */
export function Demo(props: { you: string; them: string; alt: string }) {
  return (
    <div className="demo" role="img" aria-label={props.alt} data-reveal>
      <div className="demo-side">
        <div className="demo-screen">
          <span className="demo-tag">{props.you}</span>
          <Avatar look="plain" />
        </div>
        <Bars />
      </div>
      <svg className="demo-arrow" viewBox="0 0 48 24" aria-hidden="true">
        <path d="M2 12h40M32 3l10 9-10 9" />
      </svg>
      <div className="demo-side after">
        <div className="demo-screen demo-faces">
          <span className="demo-tag">{props.them}</span>
          <Avatar look="ears" />
          <Avatar look="hair" />
          <Avatar look="cap" />
        </div>
        <Bars />
      </div>
    </div>
  );
}
