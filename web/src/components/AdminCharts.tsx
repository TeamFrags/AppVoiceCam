'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface Series {
  name: string;
  values: number[];
}

const HEIGHT = 240;
const PAD = { top: 12, right: 14, bottom: 26, left: 46 };
const GRID_STEPS = 4;

/** Top of the scale: the smallest round number that leaves whole values on every grid line. */
function scaleTop(peak: number): number {
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const base of [1, 2, 5]) {
      const step = base * magnitude;
      if (step * GRID_STEPS >= peak) return step * GRID_STEPS;
    }
  }
}

/**
 * Lines over time, all on one scale. Pointing at the chart, or moving through it with the arrow
 * keys, shows the values of that day. The same numbers are in a table for screen readers.
 */
export function LineChart({
  title,
  labels,
  series,
  format,
}: {
  title: string;
  labels: string[];
  series: Series[];
  format: (value: number) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const count = labels.length;
  const top = scaleTop(Math.max(1, ...series.flatMap((s) => s.values)));
  const innerWidth = Math.max(1, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (count > 1 ? (i / (count - 1)) * innerWidth : innerWidth / 2);
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;
  const baseline = y(0);
  const line = (values: number[]) =>
    values
      .map((value, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(value).toFixed(1)}`)
      .join(' ');

  const point = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.clientX - event.currentTarget.getBoundingClientRect().left;
    const index = Math.round(((left - PAD.left) / innerWidth) * (count - 1));
    setActive(Math.min(count - 1, Math.max(0, index)));
  };
  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((i) => Math.min(count - 1, Math.max(0, (i ?? (move > 0 ? -1 : count)) + move)));
  };

  const ticks = [...new Set([0, Math.floor((count - 1) / 2), count - 1])];
  const anchors = ['start', 'middle', 'end'] as const;

  return (
    <div className="linechart">
      {series.length > 1 && (
        <ul className="legend">
          {series.map((s, i) => (
            <li key={s.name}>
              <i data-tone={i + 1} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div className="linechart-plot" ref={box}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title}
          tabIndex={0}
          onPointerMove={point}
          onPointerDown={point}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          {Array.from({ length: GRID_STEPS + 1 }, (_, i) => (top / GRID_STEPS) * i).map((value) => (
            <g key={value}>
              <line
                className="grid-line"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(value)}
                y2={y(value)}
              />
              <text
                className="axis-label"
                x={PAD.left - 8}
                y={y(value)}
                dy="0.32em"
                textAnchor="end"
              >
                {format(value)}
              </text>
            </g>
          ))}
          {ticks.map((index, i) => (
            <text
              key={index}
              className="axis-label"
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={ticks.length === 1 ? 'middle' : anchors[i]}
            >
              {labels[index]}
            </text>
          ))}
          {series.length === 1 && count > 1 && (
            <path
              className="area"
              d={`${line(series[0]!.values)} L${x(count - 1)} ${baseline} L${x(0)} ${baseline} Z`}
            />
          )}
          {series.map((s, i) => (
            <path key={s.name} className="line" data-tone={i + 1} d={line(s.values)} />
          ))}
          {active !== null && (
            <>
              <line
                className="crosshair"
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={baseline}
              />
              {series.map((s, i) => (
                <circle
                  key={s.name}
                  className="dot"
                  data-tone={i + 1}
                  cx={x(active)}
                  cy={y(s.values[active] ?? 0)}
                  r={5}
                />
              ))}
            </>
          )}
        </svg>
        {active !== null && (
          <div
            className="chart-tip"
            // Flips to the other side of the crosshair past the middle, so it stays in the card.
            style={
              x(active) > width / 2 ? { right: width - x(active) + 12 } : { left: x(active) + 12 }
            }
          >
            <span className="muted">{labels[active]}</span>
            {series.map((s, i) => (
              <span key={s.name}>
                <i data-tone={i + 1} />
                {s.name}
                <strong>{format(s.values[active] ?? 0)}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <td />
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.name}>{format(s.values[i] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One bar per period, from the baseline. The figure above reads the bar pointed at, or the total. */
export function BarChart({
  bars,
  totalLabel,
  axis,
  format,
}: {
  bars: { label: string; value: number }[];
  totalLabel: string;
  /** Labels spread under the bars. By default, those of the first and last bar. */
  axis?: string[];
  format: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const peak = Math.max(1, ...bars.map((bar) => bar.value));
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const shown = hovered !== null ? bars[hovered] : undefined;

  return (
    <>
      <p className="chart-readout" aria-live="polite">
        <strong>{format(shown ? shown.value : total)}</strong>{' '}
        <span className="muted">{shown ? shown.label : totalLabel}</span>
      </p>
      <div className="chart" onPointerLeave={() => setHovered(null)}>
        {bars.map((bar, i) => (
          <button
            key={bar.label}
            type="button"
            className="chart-slot"
            aria-label={`${bar.label}: ${format(bar.value)}`}
            onPointerEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
          >
            <i style={{ height: `${(bar.value / peak) * 100}%` }} />
          </button>
        ))}
      </div>
      <p className="chart-axis muted">
        {(axis ?? [bars[0]?.label, bars.at(-1)?.label]).map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </p>
    </>
  );
}

/** A ranking: each line carries its name, its figure and a bar proportional to the first one. */
export function BarList({
  rows,
  empty,
  format,
}: {
  rows: { label: string; value: number }[];
  empty: string;
  format: (value: number) => string;
}) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  const peak = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="barlist">
      {rows.map((row) => (
        <li key={row.label}>
          <span>{row.label}</span>
          <strong>{format(row.value)}</strong>
          <i style={{ width: `${(row.value / peak) * 100}%` }} />
        </li>
      ))}
    </ul>
  );
}
