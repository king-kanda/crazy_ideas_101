import 'next-auth';
import 'next-auth/jwt';

interface PaldaAuth {
  token: string;
  apiKey: string;
  storeId: string;
  workspaceId: string;
  merchantId: string;
}

declare module 'next-auth' {
  interface Session {
    palda?: PaldaAuth;
    paldaError?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    palda?: PaldaAuth;
    paldaError?: string;
  }
}
