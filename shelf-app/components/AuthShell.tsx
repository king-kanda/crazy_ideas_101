'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

/** Six-way asterisk brand mark, colored via `currentColor`. */
export function Asterisk({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
    </svg>
  );
}

/**
 * Split-panel auth layout: a solid ink marketing panel on the left (flat, no
 * gradient — per the Palda design system) and the form on the right.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  heroEyebrow = 'You can easily',
  heroHeadline = 'Turn every ad click, DM, and cart into revenue you can see.',
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  heroEyebrow?: string;
  heroHeadline?: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border bg-card p-2 shadow-sm md:grid-cols-2">
        {/* ── Marketing panel ─────────────────────────────────── */}
        <div className="relative hidden overflow-hidden rounded-2xl bg-ink p-8 text-background md:flex md:flex-col md:justify-between">
          {/* Faint oversized watermark mark — flat, no gradient. */}
          <Asterisk className="pointer-events-none absolute -right-10 -top-10 size-56 text-lime opacity-[0.06]" />

          <div className="relative flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-lime text-ink">
              <Asterisk className="size-5" />
            </span>
            <span
              className="text-lg font-extrabold tracking-tight"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              PALDA
            </span>
          </div>

          <div className="relative">
            <div className="text-[11px] uppercase tracking-[0.18em] text-background/60">
              {heroEyebrow}
            </div>
            <h2
              className="mt-3 text-2xl font-bold leading-snug"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {heroHeadline}
            </h2>
          </div>
        </div>

        {/* ── Form panel ──────────────────────────────────────── */}
        <div className="flex flex-col justify-center gap-6 p-6 sm:p-10">
          <div>
            <span className="mb-5 flex size-9 items-center justify-center rounded-lg bg-lime text-ink md:hidden">
              <Asterisk className="size-5" />
            </span>
            <h1
              className="text-2xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          <div className="text-center text-xs text-muted-foreground">{footer}</div>
        </div>
      </div>
    </div>
  );
}

/** Text/email field with the label styling used across the auth forms. */
export function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground"
      >
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}

/** Password field with a show/hide toggle (matches the mockup's eye affordance). */
export function PasswordField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Input id={id} type={show ? 'text' : 'password'} className="pr-10" {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
