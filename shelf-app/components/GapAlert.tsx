interface GapAlertProps {
  signal: string;
  severity: 'high' | 'medium' | 'low';
  category?: string;
  action?: string;
  index: number;
}

const SEV = {
  high:   { color: 'var(--danger)',  bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.25)',   label: 'HIGH PRIORITY' },
  medium: { color: 'var(--warning)', bg: 'rgba(249,115,22,0.06)',  border: 'rgba(249,115,22,0.25)',  label: 'MEDIUM' },
  low:    { color: 'var(--accent)',  bg: 'rgba(245,158,11,0.05)',  border: 'rgba(245,158,11,0.2)',   label: 'LOW' },
};

export default function GapAlert({ signal, severity, category, action, index }: GapAlertProps) {
  const s = SEV[severity];

  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.color}`,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.12em',
            padding: '2px 7px',
            border: `1px solid ${s.color}`,
            color: s.color,
            fontFamily: 'DM Mono, monospace',
            flexShrink: 0,
          }}
        >
          {s.label}
        </span>
        {category && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              padding: '2px 7px',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontFamily: 'DM Mono, monospace',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            {category}
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: 'var(--text-faint)',
            letterSpacing: '0.08em',
            fontFamily: 'DM Mono, monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          </svg>
          AI ANALYSIS #{index + 1}
        </span>
      </div>

      {/* Signal */}
      <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
        {signal}
      </p>

      {/* Action */}
      {action && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M8 1l1.8 5.4H15l-4.6 3.4 1.8 5.4L8 12 3.8 15.2l1.8-5.4L1 6.4h5.2L8 1z" stroke="var(--accent)" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 6 }}>Recommended action:</span>
            {action}
          </span>
        </div>
      )}
    </div>
  );
}
