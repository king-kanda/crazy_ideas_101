interface GapAlertProps {
  signal: string;
  severity: 'high' | 'medium' | 'low';
}

const SEVERITY_COLORS = {
  high: 'var(--danger)',
  medium: 'var(--warning)',
  low: 'var(--accent)',
};

const SEVERITY_BG = {
  high: 'rgba(239,68,68,0.06)',
  medium: 'rgba(249,115,22,0.06)',
  low: 'rgba(245,158,11,0.06)',
};

const SEVERITY_LABEL = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

export default function GapAlert({ signal, severity }: GapAlertProps) {
  const color = SEVERITY_COLORS[severity];
  const bg = SEVERITY_BG[severity];
  const label = SEVERITY_LABEL[severity];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: bg,
        borderLeft: `3px solid ${color}`,
        border: `1px solid var(--border)`,
        borderLeftColor: color,
      }}
    >
      {/* Severity badge */}
      <div
        style={{
          flexShrink: 0,
          padding: '2px 6px',
          border: `1px solid ${color}`,
          color: color,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          marginTop: 1,
        }}
      >
        {label}
      </div>

      {/* Signal text */}
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{signal}</div>
    </div>
  );
}
