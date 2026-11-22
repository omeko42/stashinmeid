export interface SingleIntegrationConfig {
  enabled: boolean;
  provider: string;
  environment: 'sandbox' | 'production';
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  webhookUrl: string;
  webhookSecret?: string;
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
    webhookUrl: 'https://stashinme.biz.id/api/membership/webhook',
    webhookSecret: '',
    extraOption: 'QRIS & Virtual Account (Rp 0 biaya bulanan)',
    lastTestedAt: null,
    lastTestStatus: null,
    lastLatencyMs: null,
  },
  kyc: {
    enabled: false,
    provider: 'didit_free',
    environment: 'sandbox',
    baseUrl: 'https://verification.didit.me/v1',
    publicKey: '',
    secretKey: '',
    webhookUrl: 'https://stashinme.biz.id/api/integrations?webhook=kyc',
    extraOption: 'Didit Free Tier (Gratis hingga 500 verifikasi/bulan)',
    lastTestedAt: null,
    lastTestStatus: null,
    lastLatencyMs: null,
  },
  news: {
    enabled: true,
    provider: 'free_bundle',
    environment: 'production',
    baseUrl: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,SGD,EUR',
    publicKey: '',
    secretKey: '',
    webhookUrl: '',
    extraOption: 'Gratis tanpa API Key · CNBC ID, Antara, CoinGecko & Kurs FX',
    lastTestedAt: null,
    lastTestStatus: 'ok',
    lastLatencyMs: 140,
  },
  messaging_ai: {
    enabled: true,
    provider: 'gemini_free',
    environment: 'production',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    publicKey: '',
    secretKey: '',
    webhookUrl: '',
    extraOption: 'Google AI Studio Free Tier · Pindai Struk',
    lastTestedAt: null,
    lastTestStatus: 'ok',
    lastLatencyMs: 180,
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
