'use client';

import { useState, useRef } from 'react';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid var(--border)',
            color: 'var(--text-faint)',
            fontSize: 9,
            fontWeight: 700,
            cursor: 'default',
            fontFamily: 'DM Mono, monospace',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          ?
        </span>
      )}
      {visible && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 7px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            fontSize: 11,
            lineHeight: 1.55,
            padding: '8px 11px',
            whiteSpace: 'normal',
            width: 220,
            zIndex: 999,
            pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          }}
        >
          {text}
          {/* Arrow */}
          <span
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 8,
              height: 8,
              background: 'var(--card)',
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}
          />
        </span>
      )}
    </span>
  );
}
