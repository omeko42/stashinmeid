'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CheckCircle2,
  Copy,
  CreditCard,
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
import { useConfirm } from '@/components/ui/ConfirmProvider';
import {
  DEFAULT_API_INTEGRATIONS,
  type ApiIntegrationsState,
  type SingleIntegrationConfig,
} from '@/lib/integrations';

export const API_INTEGRATIONS_STORAGE_KEY = 'stashinmeid_api_integrations';
export const API_INTEGRATIONS_UPDATED_EVENT =
  'stashinmeid:api-integrations-updated';

type IntegrationKey = keyof ApiIntegrationsState;

interface ProviderPreset {
  id: string;
  label: string;
  tier: string;
  sandboxUrl: string;
  productionUrl: string;
  defaultExtra: string;
}

const PROVIDER_PRESETS: Record<IntegrationKey, ProviderPreset[]> = {
  news: [
    {
      id: 'free_bundle',
      label: 'CNBC ID + Antara + CoinGecko + ECB',
      tier: '100% Gratis · Tanpa API Key',
      sandboxUrl:
        'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,SGD,EUR',
      productionUrl:
        'https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR,SGD,EUR',
      defaultExtra: 'Aktif otomatis · Berita ekonomi & kurs live',
    },
    {
      id: 'gnews_free',
      label: 'GNews.io (Free Tier)',
      tier: 'Gratis 100 req/hari',
      sandboxUrl:
        'https://gnews.io/api/v4/top-headlines?category=business&lang=id',
      productionUrl:
        'https://gnews.io/api/v4/top-headlines?category=business&lang=id',
      defaultExtra: 'Berita bisnis & finansial Indonesia/Global',
    },
    {
      id: 'finnhub_free',
      label: 'Finnhub Market API (Free Tier)',
      tier: 'Gratis 60 req/menit',
      sandboxUrl: 'https://finnhub.io/api/v1/news?category=general',
      productionUrl: 'https://finnhub.io/api/v1/news?category=general',
      defaultExtra: 'Saham global, forex, dan berita pasar',
    },
    {
      id: 'coingecko_free',
      label: 'CoinGecko Public API',
      tier: 'Gratis · Tanpa API Key',
      sandboxUrl: 'https://api.coingecko.com/api/v3/ping',
      productionUrl: 'https://api.coingecko.com/api/v3/ping',
      defaultExtra: 'Harga crypto & perubahan 24 jam',
    },
    {
      id: 'custom_news',
      label: 'Endpoint Berita / RSS Custom',
      tier: 'Custom',
      sandboxUrl: 'https://www.cnbcindonesia.com/market/rss',
      productionUrl: 'https://www.cnbcindonesia.com/market/rss',
      defaultExtra: 'RSS atau JSON feed pilihan sendiri',
    },
  ],
  messaging_ai: [
    {
      id: 'gemini_free',
      label: 'Google Gemini API (AI Studio)',
      tier: 'Free Tier Tersedia',
      sandboxUrl: 'https://generativelanguage.googleapis.com/v1beta',
      productionUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultExtra: 'Pindai struk belanja otomatis',
    },
    {
      id: 'telegram_free',
      label: 'Telegram Bot API',
      tier: '100% Gratis Selamanya',
      sandboxUrl: 'https://api.telegram.org',
      productionUrl: 'https://api.telegram.org',
      defaultExtra: 'Pengingat jatuh tempo & notifikasi grup ke Telegram',
    },
    {
      id: 'discord_free',
      label: 'Discord Webhook',
      tier: '100% Gratis Selamanya',
      sandboxUrl: 'https://discord.com/api/webhooks',
      productionUrl: 'https://discord.com/api/webhooks',
      defaultExtra: 'Kirim ringkasan kas grup ke channel Discord',
    },
    {
      id: 'resend_free',
      label: 'Resend Email API',
      tier: 'Gratis 3.000 email/bulan',
      sandboxUrl: 'https://api.resend.com/emails',
      productionUrl: 'https://api.resend.com/emails',
      defaultExtra: 'Notifikasi email tagihan & undangan kolega',
    },
    {
      id: 'fonnte_wa',
      label: 'Fonnte WhatsApp Starter',
      tier: 'Free Trial / Hemat',
      sandboxUrl: 'https://api.fonnte.com/send',
      productionUrl: 'https://api.fonnte.com/send',
      defaultExtra: 'Pengingat tagihan lewat WhatsApp',
    },
  ],
  payment: [
    {
      id: 'midtrans',
      label: 'Midtrans (Sandbox & Live)',
      tier: 'Rp 0 biaya bulanan',
      sandboxUrl: 'https://api.sandbox.midtrans.com/v2',
      productionUrl: 'https://api.midtrans.com/v2',
      defaultExtra: 'QRIS, Virtual Account, GoPay, ShopeePay',
    },
    {
      id: 'xendit',
      label: 'Xendit Payment',
      tier: 'Rp 0 biaya bulanan',
      sandboxUrl: 'https://api.xendit.co',
      productionUrl: 'https://api.xendit.co',
      defaultExtra: 'QRIS, VA, OVO, DANA',
    },
    {
      id: 'tripay',
      label: 'Tripay / Duitku Starter',
      tier: 'Ramah Pemula & UMKM',
      sandboxUrl: 'https://tripay.co.id/api-sandbox',
      productionUrl: 'https://tripay.co.id/api',
      defaultExtra: 'QRIS & transfer bank tanpa biaya langganan',
    },
    {
      id: 'custom_payment',
      label: 'Webhook Pembayaran Custom',
      tier: 'Custom',
      sandboxUrl: 'https://api.example.com/v1/payment',
      productionUrl: 'https://api.example.com/v1/payment',
      defaultExtra: 'Endpoint pembayaran pilihan sendiri',
    },
  ],
  kyc: [
    {
      id: 'didit_free',
      label: 'Didit.me KYC',
      tier: 'Gratis 500 verifikasi/bln',
      sandboxUrl: 'https://verification.didit.me/v1',
      productionUrl: 'https://verification.didit.me/v1',
      defaultExtra: 'Verifikasi KTP & wajah gratis untuk tahap awal',
    },
    {
      id: 'verihubs',
      label: 'Verihubs e-KYC Indonesia',
      tier: 'Sandbox Gratis',
      sandboxUrl: 'https://api.verihubs.com/v1/ktp/verify',
      productionUrl: 'https://api.verihubs.com/v1/ktp/verify',
      defaultExtra: 'Cek NIK & OCR e-KTP Indonesia',
    },
    {
      id: 'sumsub',
      label: 'Sumsub KYC Sandbox',
      tier: 'Sandbox Gratis',
      sandboxUrl: 'https://api.sumsub.com',
      productionUrl: 'https://api.sumsub.com',
      defaultExtra: 'Verifikasi identitas global',
    },
    {
      id: 'custom_kyc',
      label: 'Endpoint KYC Custom',
      tier: 'Custom',
      sandboxUrl: 'https://kyc.example.com/v1/verify',
      productionUrl: 'https://kyc.example.com/v1/verify',
      defaultExtra: 'Provider verifikasi pilihan sendiri',
    },
  ],
};

const CATEGORY_META: {
  key: IntegrationKey;
  title: string;
  badge: string;
  subtitle: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'news',
    title: 'Berita & Kurs Pasar',
    badge: 'Gratis · Aktif',
    subtitle: 'Sumber berita ekonomi & kurs live untuk menu Sosial dan Beranda.',
    icon: <Newspaper className="size-4 text-[var(--in)]" />,
  },
  {
    key: 'messaging_ai',
    title: 'AI Struk & Notifikasi',
    badge: 'Free Tier',
    subtitle: 'Pindai struk AI (Gemini) dan notifikasi gratis (Telegram/Discord/Email).',
    icon: <Bot className="size-4 text-[var(--due)]" />,
  },
  {
    key: 'payment',
    title: 'Pembayaran (Payment)',
    badge: 'Rp 0/bln',
    subtitle: 'QRIS & Virtual Account tanpa biaya langganan bulanan.',
    icon: <CreditCard className="size-4 text-[var(--brand)]" />,
  },
  {
    key: 'kyc',
    title: 'Verifikasi KYC',
    badge: 'Free Tier',
    subtitle: 'Verifikasi identitas lewat provider pihak ketiga (gratis tahap awal).',
    icon: <FileBadge className="size-4 text-[var(--info)]" />,
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
  const { confirm } = useConfirm();
  const [integrations, setIntegrations] = useState<ApiIntegrationsState>(
    DEFAULT_API_INTEGRATIONS
  );
  const [activeCategory, setActiveCategory] = useState<IntegrationKey>('news');
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
    const ok = await confirm({
      title: 'Simpan perubahan koneksi API?',
      description:
        'Pengaturan provider, endpoint, dan kunci API pihak ketiga akan diperbarui untuk akun ini.',
      audit: {
        action: 'Simpan Koneksi API',
        category: 'settings',
        detail: `Kategori aktif: ${activeCategory}`,
      },
    });
    if (!ok) return;

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
        toast.error(json.error || 'Gagal menyimpan konfigurasi API.');
        return;
      }
      if (json.updatedAt) setUpdatedAt(json.updatedAt);
      toast.success('Koneksi API berhasil disimpan.');
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
        toast.success(json.message || 'Endpoint merespons normal.');
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
          json.error || json.message || 'Endpoint tidak merespons.'
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
  const selectedPreset =
    presets.find((p) => p.id === currentConfig.provider) ?? presets[0];

  return (
    <div className="space-y-4">
      {/* Header & Kartu 4 Integrasi */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Plug className="size-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[14px] font-semibold text-[var(--text)]">
                  Koneksi API Pihak Ketiga
                </h3>
                <span className="rounded-full bg-[var(--in-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--in)]">
                  {activeCount}/4 Aktif
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Sudah dilengkapi preset layanan gratis &amp; free-tier untuk
                berita, kurs, AI struk, notifikasi, KYC, dan pembayaran.
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
              Simpan
            </Button>
          </div>
        </div>

        {/* 4 Kartu Kategori */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_META.map((item) => {
            const cfg = integrations[item.key];
            const selected = activeCategory === item.key;
            const preset =
              PROVIDER_PRESETS[item.key].find((p) => p.id === cfg.provider) ??
              PROVIDER_PRESETS[item.key][0];

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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                    {preset.label}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-[var(--line)]/60 pt-2 text-[10px] text-[var(--text-faint)]">
                  <span>{preset.tier}</span>
                  {cfg.lastLatencyMs && (
                    <span className="tnum text-[var(--in)]">
                      {cfg.lastLatencyMs} ms
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail Form */}
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
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[15px] font-semibold text-[var(--text)]">
                      {currentMeta.title}
                    </h4>
                    <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
                      {selectedPreset.tier}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {currentMeta.subtitle}
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

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`api-provider-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Provider (Gratis / Starter)
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
                      {p.label} — {p.tier}
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
                  <option value="sandbox">Sandbox (Uji Coba)</option>
                  <option value="production">Production (Live)</option>
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
                  Catatan / Channel
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
                  placeholder="QRIS, Telegram, RSS"
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
                  Public Key / App ID (Opsional jika gratis)
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
                  placeholder="Kosongkan jika tanpa API key"
                  autoComplete="off"
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 font-mono text-[12px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              <div>
                <PasswordInput
                  id={`api-secretkey-${activeCategory}`}
                  name={`apiSecretKey_${activeCategory}`}
                  label="Secret Key / Token (Opsional)"
                  value={currentConfig.secretKey}
                  onChange={(e) =>
                    updateCategory(activeCategory, {
                      secretKey: e.target.value,
                    })
                  }
                  placeholder="Kosongkan jika tidak perlu"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {activeCategory !== 'news' && (
              <div className="mt-4">
                <label
                  htmlFor={`api-webhook-${activeCategory}`}
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Callback URL
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
                      toast.success('URL disalin.');
                    }}
                  >
                    Salin
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {currentConfig.lastTestStatus === 'ok' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--in-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--in)]">
                    <CheckCircle2 className="size-3.5" />
                    Terhubung · {currentConfig.lastLatencyMs ?? 120} ms
                  </span>
                ) : currentConfig.lastTestStatus === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--out-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--out)]">
                    <XCircle className="size-3.5" />
                    Gagal / Timeout
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]">
                    <ShieldCheck className="size-3.5" />
                    Siap diuji
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
