import type { FunnelStage } from '@/lib/api';

interface Props {
  stages: FunnelStage[];
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%';
  return ((a / b) * 100).toFixed(1) + '%';
}

export default function CartFunnel({ stages }: Props) {
  if (!stages.length) return null;

  return (
    <div>
      <div className="section-header">
        <span>Purchase Funnel</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
          {pct(stages[stages.length - 1]?.count, stages[0]?.count)} overall conversion
        </span>
      </div>

      {/* Flow diagram */}
      <div className="card" style={{ padding: '24px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
          }}
        >
          {stages.map((stage, i) => {
            const isLast = i === stages.length - 1;
            const nextStage = stages[i + 1];
            const convRate = nextStage ? pct(nextStage.count, stage.count) : null;
            const dropRate = nextStage
              ? (stage.count === 0 ? '0' : (((stage.count - nextStage.count) / stage.count) * 100).toFixed(1)) + '%'
              : null;

            return (
              <div key={stage.label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {/* Stage box */}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '20px 16px',
                    border: '1px solid var(--border)',
                    background: i === stages.length - 1 ? 'rgba(245,158,11,0.06)' : 'var(--bg)',
                    borderColor: i === stages.length - 1 ? 'var(--accent)' : 'var(--border)',
                    textAlign: 'center',
                  }}
                >
                  {/* Count */}
                  <div
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      fontSize: 26,
                      fontWeight: 400,
                      color: i === stages.length - 1 ? 'var(--accent)' : 'var(--text)',
                      marginBottom: 6,
                    }}
                  >
                    {stage.count.toLocaleString()}
                  </div>
                  {/* Label */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {stage.label}
                  </div>
                  {/* Conversion from first stage */}
                  {i > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      {pct(stage.count, stages[0].count)} of start
                    </div>
                  )}
                </div>

                {/* Arrow + conversion label */}
                {!isLast && convRate && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '0 6px',
                      flexShrink: 0,
                      gap: 4,
                    }}
                  >
                    {/* Drop % */}
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--danger)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      -{dropRate}
                    </div>
                    {/* Arrow */}
                    <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                      <path
                        d="M0 6h16M12 1l7 5-7 5"
                        stroke="var(--border)"
                        strokeWidth="1.5"
                        strokeLinecap="square"
                      />
                    </svg>
                    {/* Conv rate */}
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {convRate}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Visual bar representation */}
        <div style={{ marginTop: 20, display: 'flex', gap: 2, height: 4 }}>
          {stages.map((stage, i) => {
            const widthPct = stages[0].count === 0 ? 0 : (stage.count / stages[0].count) * 100;
            return (
              <div
                key={stage.label + '-bar'}
                style={{
                  height: 4,
                  width: `${widthPct}%`,
                  background: i === stages.length - 1 ? 'var(--accent)' : `rgba(245,158,11,${0.3 + i * 0.1})`,
                  transition: 'width 0.3s',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
