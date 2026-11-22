'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  FileBadge,
  Loader2,
  Newspaper,
  Plug,
  RefreshCw,
  Save,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import {
  DEFAULT_API_INTEGRATIONS,
  type ApiIntegrationsState,
  type SingleIntegrationConfig,
} from '@/lib/integrations';

export const API_INTEGRATIONS_STORAGE_KEY = 'stashinmeid_api_integrations';
export const API_INTEGRATIONS_UPDATED_EVENT = 'stashinmeid:api-integrations-updated';

type IntegrationKey = keyof ApiIntegrationsState;

interface ProviderPreset {
  id: string;
  label: string;
  sandboxUrl: string;
  productionUrl: string;
  defaultExtra: string;
}

const PROVIDER_PRESETS: Record<IntegrationKey, ProviderPreset[]> = {
  payment: [
    {
      id: 'midtrans',
      label: 'Midtrans (Snap & Core API)',
      sandboxUrl: 'https://api.sandbox.midtrans.com/v2',
      productionUrl: 'https://api.midtrans.com/v2',
      defaultExtra: 'QRIS, Virtual Account (BCA/Mandiri/BRI), GoPay, ShopeePay',
    },
    {
      id: 'xendit',
      label: 'Xendit Payment Gateway',
      sandboxUrl: 'https://api.xendit.co',
      productionUrl: 'https://api.xendit.co',
      defaultExtra: 'QRIS Dinamis, Virtual Account, OVO, DANA, Auto-Debet Cicilan',
    },
    {
      id: 'doku',
      label: 'DOKU Jokul Checkout',
      sandboxUrl: 'https://api-sandbox.doku.com',
      productionUrl: 'https://api.doku.com',
      defaultExtra: 'QRIS, Virtual Account, Kartu Kredit/Debit',
    },
    {
      id: 'stripe',
      label: 'Stripe Global Payments',
      sandboxUrl: 'https://api.stripe.com/v1',
      productionUrl: 'https://api.stripe.com/v1',
      defaultExtra: 'Multi-Currency Card, Apple Pay, Google Pay',
    },
    {
      id: 'custom_payment',
      label: 'Custom QRIS / Open Banking API',
      sandboxUrl: 'https://sandbox.openbanking.example.com/v1',
      productionUrl: 'https://api.openbanking.example.com/v1',
      defaultExtra: 'Custom Webhook & Settlement Callback',
    },
  ],
  kyc: [
    {
      id: 'verihubs',
      label: 'Verihubs e-KYC & Dukcapil Indonesia',
      sandboxUrl: 'https://api.verihubs.com/v1/ktp/verify',
      productionUrl: 'https://api.verihubs.com/v1/ktp/verify',
      defaultExtra: 'OCR e-KTP + Validasi NIK Dukcapil + Liveness (Zero File Storage)',
    },
    {
      id: 'privyid',
      label: 'PrivyID Digital Identity & e-KYC',
      sandboxUrl: 'https://stg-core.privy.id/v3/merchant',
      productionUrl: 'https://core.privy.id/v3/merchant',
      defaultExtra: 'Verifikasi Identitas Tersertifikasi Kominfo & Tanda Tangan Digital',
    },
    {
      id: 'vida',
      label: 'VIDA Digital Identity',
      sandboxUrl: 'https://api-sandbox.vida.id/kyc/v1',
      productionUrl: 'https://api.vida.id/kyc/v1',
      defaultExtra: 'Biometric Face Match & e-KTP Verification',
    },
    {
      id: 'sumsub',
      label: 'Sumsub Global KYC & AML Screening',
      sandboxUrl: 'https://api.sumsub.com',
      productionUrl: 'https://api.sumsub.com',
      defaultExtra: 'ID Verification, Pep/Sanctions AML Check',
    },
    {
      id: 'custom_kyc',
      label: 'Custom Third-Party e-KYC Endpoint',
      sandboxUrl: 'https://sandbox-kyc.example.com/v1/verify',
      productionUrl: 'https://kyc.example.com/v1/verify',
      defaultExtra: 'Offload Dokumen KYC & Simpan Verification Token Saja',
    },
  ],
  news: [
    {
      id: 'finnhub_rss',
      label: 'Frankfurter ECB FX + Market Stream',
      sandboxUrl: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,EUR,SGD,JPY',
      productionUrl: 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,EUR,SGD,JPY',
      defaultExtra: 'Indonesia & Global Macro (Stream Langsung, 0 KB Beban DB)',
    },
    {
      id: 'newsapi',
      label: 'NewsAPI.org (Business & Finance)',
      sandboxUrl: 'https://newsapi.org/v2/top-headlines?category=business&country=id',
      productionUrl: 'https://newsapi.org/v2/top-headlines?category=business&country=id',
      defaultExtra: 'Berita Ekonomi Nasional, Perbankan, IHSG & Kebijakan BI',
    },
    {
      id: 'alphavantage',
      label: 'Alpha Vantage Market News & Sentiment',
      sandboxUrl: 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT',
      productionUrl: 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT',
      defaultExtra: 'Global Equities, Forex, Crypto & Macro Sentiment Score',
    },
    {
      id: 'coingecko',
      label: 'CoinGecko & CryptoPanic Market API',
      sandboxUrl: 'https://api.coingecko.com/api/v3/ping',
      productionUrl: 'https://api.coingecko.com/api/v3/ping',
      defaultExtra: 'Harga Aset Digital, Market Cap & Berita Web3',
    },
    {
      id: 'custom_news',
      label: 'Custom JSON / RSS Finance News Endpoint',
      sandboxUrl: 'https://api.example.com/v1/finance-news',
      productionUrl: 'https://api.example.com/v1/finance-news',
      defaultExtra: 'Custom JSON Feed Endpoint (Tanpa Simpan Artikel ke DB)',
    },
  ],
  messaging_ai: [
    {
      id: 'gemini_vision',
      label: 'Google Gemini Vision API (OCR Struk & AI)',
      sandboxUrl: 'https://generativelanguage.googleapis.com/v1beta',
      productionUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultExtra: 'Ekstraksi Struk Belanja Otomatis & Kategori AI',
    },
    {
      id: 'fonnte_wa',
      label: 'Fonnte WhatsApp Notification Gateway',
      sandboxUrl: 'https://api.fonnte.com/send',
      productionUrl: 'https://api.fonnte.com/send',
      defaultExtra: 'Notifikasi WA Pengingat Jatuh Tempo Cicilan & Kas Grup',
    },
    {
      id: 'wablas_wa',
      label: 'Wablas WhatsApp Business API',
      sandboxUrl: 'https://pati.wablas.com/api/send-message',
      productionUrl: 'https://pati.wablas.com/api/send-message',
      defaultExtra: 'Alert Tagihan & Undangan Grup Kolega via WhatsApp',
    },
    {
      id: 'openai_vision',
      label: 'OpenAI GPT-4o Vision & Financial Assistant',
      sandboxUrl: 'https://api.openai.com/v1/chat/completions',
      productionUrl: 'https://api.openai.com/v1/chat/completions',
      defaultExtra: 'OCR Struk Multi-Bahasa & Analisis Cashflow',
    },
    {
      id: 'custom_webhook',
      label: 'Custom Webhook / Telegram Bot Gateway',
      sandboxUrl: 'https://api.telegram.org',
      productionUrl: 'https://api.telegram.org',
      defaultExtra: 'Forward Event Transaksi & Alert Keamanan ke Webhook Eksternal',
    },
  ],
};

const CATEGORY_META: {
  key: IntegrationKey;
  title: string;
  badge: string;
  subtitle: string;
  dbSavingNote: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'payment',
    title: 'Payment Gateway',
    badge: 'Pembayaran',
    subtitle: 'Integrasi cicilan, split-bill grup, QRIS, dan Virtual Account.',
    dbSavingNote: 'Hanya simpan referensi & status transaksi di DB internal.',
    icon: <CreditCard className="size-4 text-[var(--brand)]" />,
  },
  {
    key: 'kyc',
    title: 'e-KYC Pihak Ketiga',
    badge: 'Identitas',
    subtitle: 'Verifikasi NIK e-KTP & liveness lewat provider eksternal.',
    dbSavingNote: 'Dokumen tidak disimpan di storage kita; hanya token status.',
    icon: <FileBadge className="size-4 text-[var(--info)]" />,
  },
  {
    key: 'news',
    title: 'API Berita & Kurs',
    badge: 'Market Data',
    subtitle: 'Sumber berita ekonomi & kurs live untuk menu Sosial.',
    dbSavingNote: 'Stream langsung ke klien (0 KB beban database).',
    icon: <Newspaper className="size-4 text-[var(--in)]" />,
  },
  {
    key: 'messaging_ai',
    title: 'AI OCR & WhatsApp',
    badge: 'Otomasi',
    subtitle: 'Pemindai struk AI & pengingat jatuh tempo via WhatsApp/Webhook.',
    dbSavingNote: 'Gambar struk diproses di memori tanpa menyimpan file mentah.',
    icon: <Bot className="size-4 text-[var(--due)]" />,
  },
];

export function readCachedApiIntegrations(): ApiIntegrationsState {
  if (typeof window === 'undefined') return DEFAULT_API_INTEGRATIONS;
  try {
    const raw = localStorage.getItem(API_INTEGRATIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_API_INTEGRATIONS;
    const parsed = JSON.parse(raw);
    return {
      payment: { ...DEFAULT_API_INTEGRATIONS.payment, ...(parsed.payment || {}) },
      kyc: { ...DEFAULT_API_INTEGRATIONS.kyc, ...(parsed.kyc || {}) },
      news: { ...DEFAULT_API_INTEGRATIONS.news, ...(parsed.news || {}) },
      messaging_ai: {
        ...DEFAULT_API_INTEGRATIONS.messaging_ai,
        ...(parsed.messaging_ai || {}),
      },
    };
  } catch {
    return DEFAULT_API_INTEGRATIONS;
  }
}

export function ApiIntegrationsManager() {
  const [integrations, setIntegrations] = useState<ApiIntegrationsState>(
    DEFAULT_API_INTEGRATIONS
  );
  const [activeCategory, setActiveCategory] = useState<IntegrationKey>('payment');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingKey, setTestingKey] = useState<IntegrationKey | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cached = readCachedApiIntegrations();
      setIntegrations(cached);

      const res = await fetch('/api/integrations');
      if (res.ok) {
        const json = await res.json();
        if (json.integrations) {
          setIntegrations(json.integrations);
          localStorage.setItem(
            API_INTEGRATIONS_STORAGE_KEY,
            JSON.stringify(json.integrations)
          );
        }
        if (json.updatedAt) setUpdatedAt(json.updatedAt);
      }
    } catch {
      // Gunakan cache lokal jika offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const updateCategory = (
    key: IntegrationKey,
    patch: Partial<SingleIntegrationConfig>
  ) => {
    setIntegrations((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  };

  const handleProviderChange = (key: IntegrationKey, providerId: string) => {
    const preset = PROVIDER_PRESETS[key].find((p) => p.id === providerId);
    const current = integrations[key];
    if (!preset) {
      updateCategory(key, { provider: providerId });
      return;
    }
    const nextUrl =
      current.environment === 'production'
        ? preset.productionUrl
        : preset.sandboxUrl;
    updateCategory(key, {
      provider: providerId,
      baseUrl: nextUrl,
      extraOption: preset.defaultExtra,
    });
  };

  const handleEnvironmentChange = (
    key: IntegrationKey,
    env: 'sandbox' | 'production'
  ) => {
    const current = integrations[key];
    const preset = PROVIDER_PRESETS[key].find((p) => p.id === current.provider);
    updateCategory(key, {
      environment: env,
      ...(preset
        ? {
            baseUrl:
              env === 'production' ? preset.productionUrl : preset.sandboxUrl,
          }
        : {}),
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      localStorage.setItem(
        API_INTEGRATIONS_STORAGE_KEY,
        JSON.stringify(integrations)
      );
      window.dispatchEvent(new CustomEvent(API_INTEGRATIONS_UPDATED_EVENT));

      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          integrations,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Gagal menyimpan konfigurasi API ke server.');
        return;
      }
      if (json.updatedAt) setUpdatedAt(json.updatedAt);
      toast.success('Konfigurasi koneksi API pihak ketiga berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan konfigurasi API.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (key: IntegrationKey) => {
    setTestingKey(key);
    try {
      const cfg = integrations[key];
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          category: key,
          config: cfg,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const now = new Date().toISOString();

      if (res.ok && json.ok) {
        const next: ApiIntegrationsState = {
          ...integrations,
          [key]: {
            ...cfg,
            lastTestedAt: now,
            lastTestStatus: 'ok',
            lastLatencyMs: json.latencyMs ?? 120,
          },
        };
        setIntegrations(next);
        localStorage.setItem(API_INTEGRATIONS_STORAGE_KEY, JSON.stringify(next));
        toast.success(json.message || 'Koneksi endpoint API berhasil!');
      } else {
        const next: ApiIntegrationsState = {
          ...integrations,
          [key]: {
            ...cfg,
            lastTestedAt: now,
            lastTestStatus: 'error',
            lastLatencyMs: json.latencyMs ?? null,
          },
        };
        setIntegrations(next);
        toast.error(
          json.error || json.message || 'Endpoint tidak merespons / gagal diuji.'
        );
      }
    } finally {
      setTestingKey(null);
    }
  };

  const activeCount = Object.values(integrations).filter((c) => c.enabled).length;
  const currentMeta =
    CATEGORY_META.find((m) => m.key === activeCategory) ?? CATEGORY_META[0];
  const currentConfig = integrations[activeCategory];
  const presets = PROVIDER_PRESETS[activeCategory];

  return (
    <div className="space-y-4">
      {/* Banner Arsitektur Hemat Database & Ringkasan Koneksi */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Plug className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold text-[var(--text)]">
                  Manajemen Koneksi API
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--in-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--in)]">
                  <Database className="size-3" />
                  {activeCount}/4 Aktif
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Atur endpoint pihak ketiga untuk pembayaran, e-KYC, berita, dan
                notifikasi agar beban penyimpanan tetap ringan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="size-3.5" />}
              onClick={loadConfig}
              loading={loading}
            >
              Muat Ulang
            </Button>
            <Button
              size="sm"
              icon={<Save className="size-3.5" />}
              onClick={handleSaveAll}
              loading={saving}
            >
              Simpan Konfigurasi
            </Button>
          </div>
        </div>

        {/* Kartu pemilih 4 kategori integrasi */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_META.map((item) => {
            const cfg = integrations[item.key];
            const selected = activeCategory === item.key;
            const presetLabel =
              PROVIDER_PRESETS[item.key].find((p) => p.id === cfg.provider)
                ?.label || cfg.provider;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveCategory(item.key)}
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                  selected
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)]/30 shadow-sm'
                    : 'border-[var(--line)] bg-[var(--surface-2)]/60 hover:border-[var(--text-faint)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {item.badge}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      cfg.enabled
                        ? 'bg-[var(--in-soft)] text-[var(--in)]'
                        : 'bg-[var(--surface-1)] text-[var(--text-faint)]'
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        cfg.enabled ? 'bg-[var(--in)]' : 'bg-[var(--text-faint)]'
                      }`}
                    />
                    {cfg.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>

                <div className="mt-2.5">
                  <p className="text-[13px] font-semibold text-[var(--text)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    Provider: {presetLabel}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line)]/60 pt-2 text-[10px] text-[var(--text-faint)]">
                  <span className="uppercase">{cfg.environment}</span>
                  {cfg.lastLatencyMs ? (
                    <span className="tnum text-[var(--in)]">
                      Ping {cfg.lastLatencyMs} ms
                    </span>
                  ) : (
                    <span>Belum diuji</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Detail Kategori API yang Dipilih */}
      {loading ? (
        <div className="flex justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-1)] py-12">
          <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]">
                  {currentMeta.icon}
                </div>
                <div>
                  <h4 className="text-[15px] font-semibold text-[var(--text)]">
                    {currentMeta.title}
                  </h4>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {currentMeta.subtitle} · {currentMeta.dbSavingNote}
                  </p>
                </div>
              </div>

              <label
                htmlFor={`api-enable-${activeCategory}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5"
              >
                <input
                  id={`api-enable-${activeCategory}`}
                  name={`apiEnable_${activeCategory}`}
                  type="checkbox"
                  checked={currentConfig.enabled}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      enabled: e.target.checked,
                    })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="text-[12px] font-semibold text-[var(--text)]">
                  {currentConfig.enabled ? 'Aktif' : 'Nonaktif'}
                </span>
              </label>
            </div>

            {/* Grid Input Konfigurasi API */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label
                  htmlFor={`api-provider-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Provider
                </label>
                <select
                  id={`api-provider-${activeCategory}`}
                  name={`apiProvider_${activeCategory}`}
                  value={currentConfig.provider}
                  onChange={(e) =>
                    handleProviderChange(activeCategory, e.target.value)
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`api-env-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Mode
                </label>
                <select
                  id={`api-env-${activeCategory}`}
                  name={`apiEnv_${activeCategory}`}
                  value={currentConfig.environment}
                  onChange={(e) =>
                    handleEnvironmentChange(
                      activeCategory,
                      e.target.value as 'sandbox' | 'production'
                    )
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor={`api-storage-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Penyimpanan DB
                </label>
                <select
                  id={`api-storage-${activeCategory}`}
                  name={`apiStorage_${activeCategory}`}
                  value={currentConfig.storagePolicy}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      storagePolicy: e.target.value as
                        | 'stateless'
                        | 'minimal_token'
                        | 'hybrid',
                    })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                >
                  <option value="stateless">Stateless (0 KB DB)</option>
                  <option value="minimal_token">Token &amp; Status Saja</option>
                  <option value="hybrid">Hybrid Metadata</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`api-baseurl-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Endpoint URL
                </label>
                <input
                  id={`api-baseurl-${activeCategory}`}
                  name={`apiBaseUrl_${activeCategory}`}
                  type="url"
                  value={currentConfig.baseUrl}
                  onChange={(e) =>
                    updateCategory(activeCategory, { baseUrl: e.target.value })
                  }
                  placeholder="https://api.provider.com/v1"
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 font-mono text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor={`api-extra-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Channel Aktif
                </label>
                <input
                  id={`api-extra-${activeCategory}`}
                  name={`apiExtra_${activeCategory}`}
                  type="text"
                  value={currentConfig.extraOption}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      extraOption: e.target.value,
                    })
                  }
                  placeholder="QRIS, VA, OCR e-KTP"
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`api-publickey-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Public Key / App ID
                </label>
                <input
                  id={`api-publickey-${activeCategory}`}
                  name={`apiPublicKey_${activeCategory}`}
                  type="text"
                  value={currentConfig.publicKey}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      publicKey: e.target.value,
                    })
                  }
                  placeholder="Client key atau App ID"
                  autoComplete="off"
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 font-mono text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              <div>
                <PasswordInput
                  id={`api-secretkey-${activeCategory}`}
                  name={`apiSecretKey_${activeCategory}`}
                  label="Secret Key / Token"
                  value={currentConfig.secretKey}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      secretKey: e.target.value,
                    })
                  }
                  placeholder="Secret key atau bearer token"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Webhook Callback URL */}
            <div className="mt-4">
              <label
                htmlFor={`api-webhook-${activeCategory}`}
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              >
                Webhook URL
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={`api-webhook-${activeCategory}`}
                  name={`apiWebhook_${activeCategory}`}
                  type="url"
                  value={currentConfig.webhookUrl}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      webhookUrl: e.target.value,
                    })
                  }
                  placeholder="https://stashinmeid.vercel.app/api/integrations?webhook=..."
                  className="h-9 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 font-mono text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Copy className="size-3.5" />}
                  onClick={() => {
                    if (!currentConfig.webhookUrl) return;
                    navigator.clipboard.writeText(currentConfig.webhookUrl);
                    toast.success('Webhook URL disalin.');
                  }}
                >
                  Salin
                </Button>
              </div>
            </div>

            {/* Footer Bar */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {currentConfig.lastTestStatus === 'ok' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--in-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--in)]">
                    <CheckCircle2 className="size-3.5" />
                    OK · {currentConfig.lastLatencyMs ?? 120} ms
                  </span>
                ) : currentConfig.lastTestStatus === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--out-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--out)]">
                    <XCircle className="size-3.5" />
                    Gagal / Timeout
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                    <ShieldCheck className="size-3.5" />
                    Belum diuji
                  </span>
                )}

                {updatedAt && (
                  <span className="text-[11px] text-[var(--text-faint)]">
                    · {new Date(updatedAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Activity className="size-3.5" />}
                  loading={testingKey === activeCategory}
                  onClick={() => handleTestConnection(activeCategory)}
                >
                  Tes Ping
                </Button>
                {currentConfig.baseUrl && (
                  <a
                    href={currentConfig.baseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--brand)] hover:text-[var(--text)]"
                  >
                    <ExternalLink className="size-3.5" />
                    Buka
                  </a>
                )}
                <Button
                  size="sm"
                  icon={<Save className="size-3.5" />}
                  loading={saving}
                  onClick={handleSaveAll}
                >
                  Simpan
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
