export interface SingleIntegrationConfig {
  enabled: boolean;
  provider: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  webhookUrl: string;
  storagePolicy: 'stateless' | 'minimal_token' | 'hybrid';
  extraOption: string;
  lastTestedAt?: string | null;
  lastTestStatus?: 'ok' | 'error' | null;
  lastLatencyMs?: number | null;
}

export interface ApiIntegrationsState {
  payment: SingleIntegrationConfig;
  kyc: SingleIntegrationConfig;
  news: SingleIntegrationConfig;
  messaging_ai: SingleIntegrationConfig;
}

export const DEFAULT_API_INTEGRATIONS: ApiIntegrationsState = {
  payment: {
    enabled: false,
    provider: 'midtrans',
    environment: 'sandbox',
    baseUrl: 'https://api.sandbox.midtrans.com/v2',
    publicKey: '',
    secretKey: '',
    webhookUrl: 'https://stashinmeid.vercel.app/api/integrations?webhook=payment',
    storagePolicy: 'minimal_token',
    extraOption: 'QRIS, Virtual Account, E-Wallet',
    lastTestedAt: null,
    lastTestStatus: null,
    lastLatencyMs: null,
  },
  kyc: {
    enabled: false,
    provider: 'verihubs',
    environment: 'sandbox',
    baseUrl: 'https://api.verihubs.com/v1/ktp/verify',
    publicKey: '',
    secretKey: '',
    webhookUrl: 'https://stashinmeid.vercel.app/api/integrations?webhook=kyc',
    storagePolicy: 'minimal_token',
    extraOption: 'OCR e-KTP + Dukcapil Verification (Zero File Storage)',
    lastTestedAt: null,
    lastTestStatus: null,
    lastLatencyMs: null,
  },
  news: {
    enabled: true,
    provider: 'finnhub_rss',
    environment: 'production',
    baseUrl: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,EUR,SGD,JPY',
    publicKey: '',
    secretKey: '',
    webhookUrl: '',
    storagePolicy: 'stateless',
    extraOption: 'Indonesia & Global Macro (Cache 15m, 0 KB DB Storage)',
    lastTestedAt: null,
    lastTestStatus: 'ok',
    lastLatencyMs: 142,
  },
  messaging_ai: {
    enabled: true,
    provider: 'gemini_vision',
    environment: 'production',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    publicKey: '',
    secretKey: '',
    webhookUrl: 'https://stashinmeid.vercel.app/api/integrations?webhook=messaging',
    storagePolicy: 'stateless',
    extraOption: 'AI Receipt OCR & Pengingat Jatuh Tempo',
    lastTestedAt: null,
    lastTestStatus: 'ok',
    lastLatencyMs: 185,
  },
};

export function mergeIntegrations(raw: unknown): ApiIntegrationsState {
  if (!raw || typeof raw !== 'object') return DEFAULT_API_INTEGRATIONS;
  const obj = raw as Partial<
    Record<keyof ApiIntegrationsState, Partial<SingleIntegrationConfig>>
  >;
  return {
    payment: { ...DEFAULT_API_INTEGRATIONS.payment, ...(obj.payment || {}) },
    kyc: { ...DEFAULT_API_INTEGRATIONS.kyc, ...(obj.kyc || {}) },
    news: { ...DEFAULT_API_INTEGRATIONS.news, ...(obj.news || {}) },
    messaging_ai: {
      ...DEFAULT_API_INTEGRATIONS.messaging_ai,
      ...(obj.messaging_ai || {}),
    },
  };
}
