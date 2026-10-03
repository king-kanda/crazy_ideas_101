'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import { CheckCircle2, AlertTriangle, Loader2, Plug, Unplug } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { api, type MetaConnectionStatus } from '@/lib/api';

type Platform = 'whatsapp' | 'instagram' | 'facebook';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '';
const META_GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || 'v19.0';
const CONFIG_IDS: Record<Platform, string> = {
  whatsapp: process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID || '',
  instagram: process.env.NEXT_PUBLIC_META_INSTAGRAM_CONFIG_ID || '',
  facebook: process.env.NEXT_PUBLIC_META_FACEBOOK_CONFIG_ID || '',
};

const PLATFORM_META: Record<Platform, { title: string; blurb: string }> = {
  whatsapp: {
    title: 'WhatsApp Business',
    blurb: 'Inbound customer messages → Palda inbox + agent, with webhook delivery of statuses.',
  },
  instagram: {
    title: 'Instagram',
    blurb: 'DMs, comments, and mentions routed into the Palda inbox for triage.',
  },
  facebook: {
    title: 'Facebook Page',
    blurb: 'Page messages + comments. Required if you run paid traffic to a FB Page.',
  },
};

type FBResponse = {
  authResponse?: { code?: string; accessToken?: string };
  status?: string;
};

declare global {
  interface Window {
    FB?: {
      init(opts: Record<string, unknown>): void;
      login(cb: (resp: FBResponse) => void, opts: Record<string, unknown>): void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function MetaIntegrationsPage() {
  const { auth } = useAuth();
  const token = auth?.token;
  const [sdkReady, setSdkReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<Record<Platform, MetaConnectionStatus | undefined>>({
    whatsapp: undefined,
    instagram: undefined,
    facebook: undefined,
  });
  const [busy, setBusy] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.metaStatus(token);
      const next: Record<Platform, MetaConnectionStatus | undefined> = {
        whatsapp: undefined, instagram: undefined, facebook: undefined,
      };
      for (const c of res.connections) next[c.platform] = c;
      setConnections(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!META_APP_ID) return;
    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: false,
        version: META_GRAPH_VERSION,
      });
      setSdkReady(true);
    };
  }, []);

  const connect = async (platform: Platform) => {
    if (!token) return;
    if (!META_APP_ID || !CONFIG_IDS[platform]) {
      setError(`Meta ${platform} configuration ID not set — add NEXT_PUBLIC_META_${platform.toUpperCase()}_CONFIG_ID to env.`);
      return;
    }
    if (!window.FB) {
      setError('Meta SDK not loaded yet — try again in a moment.');
      return;
    }
    setBusy(platform);
    setError(null);
    window.FB.login(
      async (resp) => {
        const code = resp.authResponse?.code;
        if (!code) {
          setBusy(null);
          setError('Signup cancelled.');
          return;
        }
        try {
          await api.metaEsCallback(token, { platform, code });
          await refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Connection failed');
        } finally {
          setBusy(null);
        }
      },
      {
        config_id: CONFIG_IDS[platform],
        response_type: 'code',
        override_default_response_type: true,
      },
    );
  };

  const disconnect = async (platform: Platform) => {
    if (!token) return;
    setBusy(platform);
    try {
      await api.metaDisconnect(token, platform);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disconnect failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" />

      <div>
        <h1 className="text-2xl font-syne font-semibold">Meta Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect WhatsApp, Instagram, and Facebook via Meta Embedded Signup. Tokens are stored encrypted; disconnect at any time.
        </p>
      </div>

      {!META_APP_ID && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Meta App ID not configured.</p>
              <p className="text-muted-foreground">Set <code>NEXT_PUBLIC_META_APP_ID</code> and the per-platform config IDs in <code>.env.local</code>, then restart the app.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 pt-6 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLATFORM_META) as Platform[]).map((platform) => {
          const conn = connections[platform];
          const meta = PLATFORM_META[platform];
          const connected = conn?.connected;
          return (
            <Card key={platform}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{meta.title}</CardTitle>
                  <StatusBadge conn={conn} loading={loading} />
                </div>
                <CardDescription>{meta.blurb}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {conn?.display_name && (
                  <p className="text-xs text-muted-foreground">
                    Connected as <span className="font-mono">{conn.display_name}</span>
                  </p>
                )}
                {conn?.last_error && (
                  <p className="text-xs text-destructive">{conn.last_error}</p>
                )}
                <div className="flex gap-2">
                  {!connected ? (
                    <Button
                      size="sm"
                      disabled={!sdkReady || busy !== null || !META_APP_ID}
                      onClick={() => connect(platform)}
                    >
                      {busy === platform ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plug className="h-3.5 w-3.5" />
                      )}
                      Connect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => disconnect(platform)}
                    >
                      {busy === platform ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unplug className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ conn, loading }: { conn?: MetaConnectionStatus; loading: boolean }) {
  if (loading) return <Badge variant="outline">…</Badge>;
  if (!conn || conn.status === 'not_connected') return <Badge variant="outline">Not connected</Badge>;
  if (conn.status === 'active') return (
    <Badge className="bg-[var(--lime-soft)] text-[var(--ink)] border-0">
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  );
  return <Badge variant="destructive">{conn.status}</Badge>;
}
