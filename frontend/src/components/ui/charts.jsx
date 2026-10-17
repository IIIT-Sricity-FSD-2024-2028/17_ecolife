import { useState } from 'react';
import './ui.css';

/**
 * Enhanced dependency-free SVG Bar Chart with:
 * - Solid X and Y axis lines and ticks
 * - Horizontal reference grid lines with formatted Y-axis labels
 * - Average benchmark reference line
 * - Rounded gradient bars with smooth hover highlight
 * - Interactive floating tooltip showing value and deviation vs average
 */
export function BarChart({
  data,
  valueKey = 'value',
  labelKey = 'label',
  format = (v) => v,
  formatYAxis,
  height = 220,
  showAverage = true,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data?.length) return null;

  const rawMax = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const order = Math.pow(10, Math.floor(Math.log10(rawMax))) || 1;
  const maxCeiling = Math.ceil((rawMax * 1.15) / (order / 2 || 1)) * (order / 2 || 1);

  const svgWidth = 600;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 38;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const gridLevels = [0, 0.333, 0.667, 1.0];

  const totalVal = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  const avgVal = totalVal / data.length;
  const avgY = height - paddingBottom - (avgVal / maxCeiling) * plotHeight;

  const slotWidth = plotWidth / data.length;
  const barWidth = Math.max(Math.min(slotWidth * 0.58, 38), 12);

  const formatY =
    formatYAxis ||
    ((val) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return Math.round(val).toLocaleString();
    });

  return (
    <div className="barchart-container" style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Bar chart"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="troposBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary, #1f6f4f)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--color-primary, #1f6f4f)" stopOpacity="0.65" />
          </linearGradient>
          <linearGradient id="troposBarHoverGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary-dark, #16523a)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--color-primary, #1f6f4f)" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines & Y-axis labels */}
        {gridLevels.map((lvl) => {
          const val = lvl * maxCeiling;
          const y = height - paddingBottom - lvl * plotHeight;
          return (
            <g key={lvl} className="barchart__grid-row">
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="var(--color-border, #e1e4e1)"
                strokeDasharray={lvl === 0 ? 'none' : '3 3'}
                strokeWidth={lvl === 0 ? '1.5' : '1'}
              />
              <text
                x={paddingLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10px"
                fill="var(--color-text-muted, #5c635e)"
                fontFamily="inherit"
              >
                {formatY(val)}
              </text>
            </g>
          );
        })}

        {/* Solid Y-axis Line on the left */}
        <line
          x1={paddingLeft}
          y1={paddingTop - 6}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="var(--color-border-strong, #c7ccc8)"
          strokeWidth="1.5"
        />

        {/* Solid X-axis Line at the bottom */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={svgWidth - paddingRight + 4}
          y2={height - paddingBottom}
          stroke="var(--color-border-strong, #c7ccc8)"
          strokeWidth="1.5"
        />

        {/* Average Benchmark Line */}
        {showAverage && data.length > 1 && avgVal > 0 && (
          <g className="barchart__avg-line">
            <line
              x1={paddingLeft}
              y1={avgY}
              x2={svgWidth - paddingRight}
              y2={avgY}
              stroke="var(--color-warning, #92650a)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text
              x={svgWidth - paddingRight}
              y={avgY - 4}
              textAnchor="end"
              fontSize="10px"
              fill="var(--color-warning, #92650a)"
              fontWeight="600"
            >
              Avg: {format(avgVal)}
            </text>
          </g>
        )}

        {/* Bars and X-axis Labels */}
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const barH = Math.max((val / maxCeiling) * plotHeight, 2);
          const x = paddingLeft + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = height - paddingBottom - barH;
          const centerX = x + barWidth / 2;
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={d[labelKey]}
              className="barchart__column"
              onMouseEnter={() => setHoveredIdx(i)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background hover highlight band */}
              {isHovered && (
                <rect
                  x={paddingLeft + i * slotWidth + 2}
                  y={paddingTop}
                  width={slotWidth - 4}
                  height={plotHeight}
                  fill="var(--color-primary-light, #e6f2ec)"
                  opacity="0.35"
                  rx="4"
                />
              )}

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx="3.5"
                fill={isHovered ? 'url(#troposBarHoverGrad)' : 'url(#troposBarGrad)'}
                opacity={hoveredIdx !== null && !isHovered ? 0.65 : 1}
                style={{ transition: 'opacity 0.15s ease, fill 0.15s ease' }}
              />

              {/* X-axis tick */}
              <line
                x1={centerX}
                y1={height - paddingBottom}
                x2={centerX}
                y2={height - paddingBottom + 4}
                stroke="var(--color-border-strong, #c7ccc8)"
                strokeWidth="1"
              />

              {/* X-axis label */}
              <text
                x={centerX}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fontSize="11px"
                fontWeight={isHovered ? '600' : '400'}
                fill={isHovered ? 'var(--color-text, #1c1f1d)' : 'var(--color-text-muted, #5c635e)'}
                fontFamily="inherit"
              >
                {d[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Interactive Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        (() => {
          const item = data[hoveredIdx];
          const val = Number(item[valueKey]) || 0;
          const leftPct = ((paddingLeft + hoveredIdx * slotWidth + slotWidth / 2) / svgWidth) * 100;
          const diffPct = avgVal > 0 ? ((val - avgVal) / avgVal) * 100 : 0;
          return (
            <div
              className="barchart__tooltip"
              style={{
                position: 'absolute',
                top: 0,
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                background: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border, #e1e4e1)',
                borderRadius: 'var(--radius-md, 6px)',
                padding: '6px 10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap',
                fontSize: 'var(--font-size-xs, 12px)',
              }}
            >
              <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>
                {item[labelKey]}
              </div>
              <div style={{ color: 'var(--color-primary-dark, #16523a)', fontWeight: '700', fontSize: '13px' }}>
                {format(val)}
              </div>
              {showAverage && avgVal > 0 && (
                <div
                  style={{
                    fontSize: '11px',
                    color: diffPct >= 0 ? 'var(--color-warning, #92650a)' : 'var(--color-success, #1f6f4f)',
                    marginTop: 2,
                  }}
                >
                  {diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`} vs. avg
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

/** Progress toward a target. Over 100% flips to the danger tone. */
export function ProgressBar({ percent }) {
  if (percent == null) return <span className="text-muted">—</span>;
  const tone = percent > 100 ? 'danger' : percent > 85 ? 'warning' : 'ok';
  return (
    <div className="progress" title={`${percent.toFixed(0)}% of target`}>
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      <span className="progress__text">{percent.toFixed(0)}%</span>
    </div>
  );
}

/** Smooth Spline Area Chart with gradient fill and interactive tooltip */
export function AreaChart({
  data,
  valueKey = 'value',
  labelKey = 'label',
  format = (v) => v,
  formatYAxis,
  height = 220,
  showAverage = true,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!data?.length) return null;

  const rawMax = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  const order = Math.pow(10, Math.floor(Math.log10(rawMax))) || 1;
  const maxCeiling = Math.ceil((rawMax * 1.15) / (order / 2 || 1)) * (order / 2 || 1);

  const svgWidth = 600;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 38;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const gridLevels = [0, 0.333, 0.667, 1.0];
  const totalVal = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  const avgVal = totalVal / data.length;
  const avgY = height - paddingBottom - (avgVal / maxCeiling) * plotHeight;

  const slotWidth = plotWidth / (data.length - 1 || 1);
  const points = data.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const x = paddingLeft + i * slotWidth;
    const y = height - paddingBottom - (val / maxCeiling) * plotHeight;
    return { x, y, d, val };
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  const formatY =
    formatYAxis ||
    ((val) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
      return Math.round(val).toLocaleString();
    });

  return (
    <div className="areachart-container" style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="Area chart"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id="troposAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary, #1f6f4f)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-primary, #1f6f4f)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLevels.map((lvl) => {
          const val = lvl * maxCeiling;
          const y = height - paddingBottom - lvl * plotHeight;
          return (
            <g key={lvl}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={svgWidth - paddingRight}
                y2={y}
                stroke="var(--color-border, #e1e4e1)"
                strokeDasharray={lvl === 0 ? 'none' : '3 3'}
                strokeWidth={lvl === 0 ? '1.5' : '1'}
              />
              <text
                x={paddingLeft - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10px"
                fill="var(--color-text-muted, #5c635e)"
                fontFamily="inherit"
              >
                {formatY(val)}
              </text>
            </g>
          );
        })}

        <line x1={paddingLeft} y1={paddingTop - 6} x2={paddingLeft} y2={height - paddingBottom} stroke="var(--color-border-strong, #c7ccc8)" strokeWidth="1.5" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={svgWidth - paddingRight + 4} y2={height - paddingBottom} stroke="var(--color-border-strong, #c7ccc8)" strokeWidth="1.5" />

        {showAverage && data.length > 1 && avgVal > 0 && (
          <g>
            <line x1={paddingLeft} y1={avgY} x2={svgWidth - paddingRight} y2={avgY} stroke="var(--color-warning, #92650a)" strokeDasharray="4 4" strokeWidth="1.5" />
            <text x={svgWidth - paddingRight} y={avgY - 4} textAnchor="end" fontSize="10px" fill="var(--color-warning, #92650a)" fontWeight="600">
              Avg: {format(avgVal)}
            </text>
          </g>
        )}

        <path d={areaD} fill="url(#troposAreaGrad)" />
        <path d={pathD} fill="none" stroke="var(--color-primary, #1f6f4f)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <g key={p.d[labelKey]} onMouseEnter={() => setHoveredIdx(i)} style={{ cursor: 'pointer' }}>
              {isHovered && (
                <line x1={p.x} y1={paddingTop} x2={p.x} y2={height - paddingBottom} stroke="var(--color-primary)" strokeDasharray="2 2" strokeWidth="1" opacity="0.6" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill="var(--color-surface, #ffffff)"
                stroke="var(--color-primary, #1f6f4f)"
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'all 0.15s ease' }}
              />
              <line x1={p.x} y1={height - paddingBottom} x2={p.x} y2={height - paddingBottom + 4} stroke="var(--color-border-strong, #c7ccc8)" strokeWidth="1" />
              <text
                x={p.x}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fontSize="11px"
                fontWeight={isHovered ? '600' : '400'}
                fill={isHovered ? 'var(--color-text, #1c1f1d)' : 'var(--color-text-muted, #5c635e)'}
                fontFamily="inherit"
              >
                {p.d[labelKey]}
              </text>
            </g>
          );
        })}
      </svg>

      {hoveredIdx !== null && data[hoveredIdx] && (
        (() => {
          const item = data[hoveredIdx];
          const val = Number(item[valueKey]) || 0;
          const leftPct = (points[hoveredIdx].x / svgWidth) * 100;
          const diffPct = avgVal > 0 ? ((val - avgVal) / avgVal) * 100 : 0;
          return (
            <div
              className="areachart__tooltip"
              style={{
                position: 'absolute',
                top: 0,
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                background: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border, #e1e4e1)',
                borderRadius: 'var(--radius-md, 6px)',
                padding: '6px 10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                pointerEvents: 'none',
                zIndex: 10,
                whiteSpace: 'nowrap',
                fontSize: 'var(--font-size-xs, 12px)',
              }}
            >
              <div style={{ fontWeight: '600', color: 'var(--color-text)' }}>{item[labelKey]}</div>
              <div style={{ color: 'var(--color-primary-dark, #16523a)', fontWeight: '700', fontSize: '13px' }}>{format(val)}</div>
              {showAverage && avgVal > 0 && (
                <div style={{ fontSize: '11px', color: diffPct >= 0 ? 'var(--color-warning, #92650a)' : 'var(--color-success, #1f6f4f)', marginTop: 2 }}>
                  {diffPct >= 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`} vs. avg
                </div>
              )}
            </div>
          );
        })()
      )}
    </div>
  );
}

/** Interactive SVG Donut Breakdown Chart with center stats and legend */
export function DonutChart({
  data = [],
  valueKey = 'value',
  labelKey = 'label',
  format = (v) => v,
  size = 190,
  colors = ['#1f6f4f', '#0d9488', '#0284c7', '#6366f1', '#d97706', '#e11d48', '#8b5cf6', '#059669'],
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const validData = data.filter((d) => (Number(d[valueKey]) || 0) > 0);
  const total = validData.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);

  if (!validData.length || total === 0) {
    return <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No distribution data available in this range.</p>;
  }

  const radius = 62;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const segments = validData.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const pct = val / total;
    const strokeDasharray = `${pct * circumference} ${circumference * (1 - pct)}`;
    const strokeDashoffset = -accumulated * circumference;
    accumulated += pct;
    const color = colors[i % colors.length];
    return {
      d,
      val,
      pct: pct * 100,
      strokeDasharray,
      strokeDashoffset,
      color,
    };
  });

  const active = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 'var(--space-5)', padding: 'var(--space-2) 0' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
          role="img"
          aria-label="Donut distribution chart"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {segments.map((seg, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <circle
                key={seg.d[labelKey]}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="butt"
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 0.15s ease, opacity 0.15s ease',
                  opacity: hoveredIdx !== null && !isHovered ? 0.6 : 1,
                }}
                onMouseEnter={() => setHoveredIdx(i)}
              />
            );
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
            padding: 8,
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '500', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active ? active.d[labelKey] : 'Total'}
          </span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)', marginTop: 1 }}>
            {active ? `${active.pct.toFixed(1)}%` : format(total)}
          </span>
          {active && (
            <span style={{ fontSize: '10px', color: active.color, fontWeight: '600', marginTop: 1 }}>
              {format(active.val)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160, flex: 1, maxWidth: 260 }}>
        {segments.map((seg, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={seg.d[labelKey]}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm, 4px)',
                cursor: 'pointer',
                background: isHovered ? 'var(--color-bg, #f7f8f7)' : 'transparent',
                fontWeight: isHovered ? '600' : '400',
                fontSize: 'var(--font-size-xs, 12px)',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.d[labelKey]}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="text-muted" style={{ fontSize: '11px' }}>{format(seg.val)}</span>
                <span className="badge badge--neutral" style={{ fontSize: '10px', padding: '1px 5px' }}>{seg.pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact inline SVG micro-sparkline for KPI cards */
export function Sparkline({ data = [], color = 'var(--color-primary, #1f6f4f)', width = 80, height = 26 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${(pad + w).toFixed(1)},${height} L ${pad},${height} Z`;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'inline-block', verticalAlign: 'middle' }}>
      <path d={areaD} fill={color} opacity="0.15" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
