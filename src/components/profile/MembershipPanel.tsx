'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_TIER_ORDER,
  YEARLY_DISCOUNT_PCT,
  computePlanDisplayPricing,
  type BillingCycle,
  type EnterpriseInquiry,
  type MembershipOrder,
  type MembershipTier,
} from '@/lib/membership';
import { formatRp } from '@/lib/format';
import { useCurrency } from '@/components/ui/CurrencyContext';

export function MembershipPanel() {
  const locale = useLocale();
  const isEn = locale === 'en';
  const { confirm } = useConfirm();
  const { primaryCurrency, idrPerUnit } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<MembershipTier>('free');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [maxGroups, setMaxGroups] = useState(3);
  const [ownedGroups, setOwnedGroups] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('midtrans');
  const [pendingOrder, setPendingOrder] = useState<MembershipOrder | null>(null);
  const [orders, setOrders] = useState<MembershipOrder[]>([]);
  const [inquiries, setInquiries] = useState<EnterpriseInquiry[]>([]);

  // Slide Switch: Reguler (3-15 Grup) vs Enterprise Custom (> 15 Grup / Pesanan Fitur)
  const [enterpriseMode, setEnterpriseMode] = useState(false);
  const [entName, setEntName] = useState('');
  const [entContact, setEntContact] = useState('');
  const [entCompany, setEntCompany] = useState('');
  const [entGroups, setEntGroups] = useState('16 - 30 Grup');
  const [entNeeds, setEntNeeds] = useState('');
  const [entSending, setEntSending] = useState(false);

  // Checkout Modal State
  const [checkoutTier, setCheckoutTier] = useState<
    Exclude<MembershipTier, 'free'> | null
  >(null);
  const [paymentMethod, setPaymentMethod] = useState('QRIS');
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<MembershipOrder | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const loadMembership = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/membership', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setTier(json.tier || 'free');
        setMaxGroups(json.maxGroups ?? 3);
        setOwnedGroups(json.ownedGroups ?? 0);
        setIsAdmin(Boolean(json.isAdmin));
        setPaymentProvider(json.paymentProvider || 'midtrans');
        setPendingOrder(json.pendingOrder ?? null);
        setOrders(Array.isArray(json.orders) ? json.orders : []);
        setInquiries(Array.isArray(json.inquiries) ? json.inquiries : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutTier) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          requestedTier: checkoutTier,
          billingCycle,
          paymentMethod,
          paymentRef,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || (isEn ? 'Checkout failed.' : 'Gagal membuat pesanan.'));
        return;
      }
      setCreatedOrder(json.order);
      setPendingOrder(json.order);
      setPaymentRef('');
      toast.success(
        isEn
          ? 'Upgrade request submitted. Waiting for admin activation.'
          : 'Pesanan upgrade dibuat. Menunggu verifikasi & aktivasi admin.'
      );
      await loadMembership();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminAction = async (
    ord: MembershipOrder,
    action: 'approve' | 'reject'
  ) => {
    const ok = await confirm({
      title:
        action === 'approve'
          ? isEn
            ? `Activate ${ord.requestedTier.toUpperCase()} for ${ord.userName}?`
            : `Aktifkan paket ${ord.requestedTier.toUpperCase()} untuk ${ord.userName}?`
          : isEn
            ? `Reject upgrade order ${ord.invoiceNo}?`
            : `Tolak pesanan upgrade ${ord.invoiceNo}?`,
      description:
        action === 'approve'
          ? isEn
            ? `Confirm payment (${ord.paymentMethod} · ${formatRp(ord.amountIdr)}) and unlock their group quota immediately.`
            : `Konfirmasi pembayaran (${ord.paymentMethod} · ${formatRp(ord.amountIdr)}) dan aktifkan kuota grup akun ini.`
          : isEn
            ? 'This upgrade request will be marked as rejected.'
            : 'Pesanan ini akan ditandai ditolak dan dicatat di log audit.',
      tone: action === 'reject' ? 'danger' : 'brand',
      audit: {
        action:
          action === 'approve'
            ? 'Aktivasi Paket Membership'
            : 'Tolak Pesanan Membership',
        category: 'membership',
        detail: `${ord.userName} · ${ord.requestedTier.toUpperCase()} (${ord.invoiceNo})`,
        targetUserId: ord.userId,
      },
    });
    if (!ok) return;

    setBusyOrderId(ord.id);
    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderId: ord.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Gagal memproses pesanan.');
        return;
      }
      if (Array.isArray(json.orders)) setOrders(json.orders);
      toast.success(
        action === 'approve'
          ? isEn
            ? 'Plan activated!'
            : 'Paket berhasil diaktifkan!'
          : isEn
            ? 'Order rejected.'
            : 'Pesanan ditolak.'
      );
      await loadMembership();
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleSubmitEnterprise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entName.trim() || !entContact.trim() || !entNeeds.trim()) {
      toast.error(
        isEn
          ? 'Please fill in your name, contact, and custom requirements.'
          : 'Nama, kontak (email/WA), dan kebutuhan aplikasi wajib diisi.'
      );
      return;
    }
    const ok = await confirm({
      title: isEn
        ? 'Submit Enterprise Custom request?'
        : 'Kirim permintaan Enterprise Custom?',
      description: isEn
        ? 'Your custom app requirements will be sent directly to the owner.'
        : 'Kebutuhan aplikasi & fitur custommu akan langsung diteruskan ke pemilik aplikasi.',
      audit: {
        action: 'Kirim Permintaan Enterprise',
        category: 'membership',
        detail: `${entCompany || entName} · ${entGroups}`,
      },
    });
    if (!ok) return;

    setEntSending(true);
    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enterprise_inquiry',
          name: entName.trim(),
          contact: entContact.trim(),
          company: entCompany.trim(),
          groupEstimate: entGroups.trim(),
          requirements: entNeeds.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Gagal mengirim permintaan.');
        return;
      }
      setEntName('');
      setEntContact('');
      setEntCompany('');
      setEntNeeds('');
      toast.success(
        isEn
          ? 'Enterprise request sent! We will contact you shortly.'
          : 'Permintaan Enterprise terkirim! Kami akan segera menghubungimu.'
      );
      await loadMembership();
    } finally {
      setEntSending(false);
    }
  };

  const handleInquiryStatus = async (
    inquiryId: string,
    status: 'contacted' | 'closed'
  ) => {
    const res = await fetch('/api/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_inquiry_status',
        inquiryId,
        status,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(json.inquiries)) {
      setInquiries(json.inquiries);
      toast.success(
        status === 'contacted' ? 'Ditandai sudah dihubungi.' : 'Permintaan ditutup.'
      );
    }
  };

  const activePlan = MEMBERSHIP_PLANS[tier];
  const usagePct = Math.min(100, Math.round((ownedGroups / Math.max(1, maxGroups)) * 100));

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-1)] py-12">
        <Loader2 className="size-6 animate-spin text-[var(--brand)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan Paket Aktif & Kuota Grup */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-[var(--text)]">
                  {isEn ? 'Current Plan' : 'Paket Aktif'}:{' '}
                  {isEn ? activePlan.labelEn : activePlan.labelId}
                </h3>
                <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
                  {isEn ? activePlan.badgeEn : activePlan.badgeId}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                {isEn ? activePlan.summaryEn : activePlan.summaryId}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            icon={<RefreshCw className="size-3.5" />}
            onClick={loadMembership}
          >
            {isEn ? 'Refresh' : 'Segarkan'}
          </Button>
        </div>

        {/* Bar Kuota Grup */}
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/70 p-3">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-muted)]">
              {isEn ? 'Owned Group Workspaces' : 'Kuota Grup Kolega / Perusahaan'}
            </span>
            <span className="tnum font-semibold text-[var(--text)]">
              {ownedGroups} / {maxGroups} {isEn ? 'groups' : 'grup'}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-1)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all"
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>

        {pendingOrder && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--due)]/35 bg-[var(--due-soft)] px-3.5 py-2.5 text-[12px]">
            <span className="inline-flex items-center gap-2 text-[var(--text)]">
              <Clock className="size-4 text-[var(--due)]" />
              <span>
                {isEn ? 'Pending upgrade' : 'Menunggu aktivasi'}:{' '}
                <strong>{pendingOrder.requestedTier.toUpperCase()}</strong> (
                {pendingOrder.invoiceNo})
              </span>
            </span>
            {pendingOrder.checkoutUrl && (
              <a
                href={pendingOrder.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] underline"
              >
                {isEn ? 'Open Payment Link' : 'Buka Link Pembayaran'}
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Slide Switch: Paket Reguler (3-15 Grup) ↔ Enterprise Custom */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">
            {enterpriseMode
              ? 'Enterprise Custom (> 15 Grup & Request Fitur)'
              : isEn
                ? 'Standard Plans (Up to 15 Groups)'
                : 'Paket Reguler (Maksimal 15 Grup)'}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {enterpriseMode
              ? isEn
                ? 'Need more than 15 groups or bespoke modules? Tell us your business requirements.'
                : 'Butuh lebih dari 15 grup atau ingin pesan fitur tambahan khusus bisnismu? Tulis kebutuhanmu di bawah.'
              : isEn
                ? 'Save 20% with yearly billing, or toggle Enterprise Custom for > 15 groups.'
                : 'Hemat 20% dengan paket tahunan, atau geser ke Enterprise Custom untuk > 15 grup.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!enterpriseMode && (
            <div className="inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  billingCycle === 'monthly'
                    ? 'bg-[var(--surface-1)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {isEn ? 'Monthly' : 'Bulanan'}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 transition ${
                  billingCycle === 'yearly'
                    ? 'bg-[var(--brand)] text-[var(--brand-contrast)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <span>{isEn ? 'Yearly' : 'Tahunan'}</span>
                <span className="text-[9px] font-bold">-{YEARLY_DISCOUNT_PCT}%</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <span
              className={`text-[12px] font-semibold ${
                !enterpriseMode ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {isEn ? 'Plans (3–15)' : 'Reguler (3–15)'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enterpriseMode}
              aria-label={
                isEn ? 'Switch to Enterprise Custom' : 'Geser ke Enterprise Custom'
              }
              onClick={() => setEnterpriseMode((v) => !v)}
              className={`relative h-6 w-12 rounded-full transition-colors ${
                enterpriseMode
                  ? 'bg-[var(--brand)]'
                  : 'border border-[var(--line)] bg-[var(--surface-2)]'
              }`}
            >
              <span
                className={`block size-4.5 rounded-full bg-white shadow transition-transform ${
                  enterpriseMode ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span
              className={`text-[12px] font-semibold ${
                enterpriseMode ? 'text-[var(--brand)]' : 'text-[var(--text-muted)]'
              }`}
            >
              Enterprise
            </span>
          </div>
        </div>
      </div>

      {/* 4 Pilihan Paket Membership Reguler ATAU Form Enterprise Custom */}
      {!enterpriseMode ? (
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {MEMBERSHIP_TIER_ORDER.map((planId) => {
          const plan = MEMBERSHIP_PLANS[planId];
          const isCurrent = tier === planId;
          const features = isEn ? plan.featuresEn : plan.featuresId;
          const p = computePlanDisplayPricing({
            plan,
            cycle: billingCycle,
            currency: primaryCurrency,
            idrPerUnit,
            locale: isEn ? 'en' : 'id',
          });

          return (
            <div
              key={planId}
              className={`flex flex-col justify-between rounded-xl border p-4 ${
                isCurrent
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)]/15'
                  : 'border-[var(--line)] bg-[var(--surface-1)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[15px] font-semibold text-[var(--text)]">
                    {isEn ? plan.labelEn : plan.labelId}
                  </h4>
                  <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                    {isEn ? plan.badgeEn : plan.badgeId}
                  </span>
                </div>

                <div className="mt-2.5 min-h-[68px]">
                  <div className="flex flex-wrap items-baseline gap-x-1">
                    <span className="tnum text-[20px] font-bold leading-tight text-[var(--text)]">
                      {p.formattedMonthlyEffective}
                    </span>
                    {plan.priceUsdMonthly > 0 && (
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">
                        {isEn ? '/mo' : '/bln'}
                      </span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && plan.priceUsdMonthly > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="tnum text-[var(--text-faint)] line-through">
                          {p.formattedMonthlyRegular}
                          {isEn ? '/mo' : '/bln'}
                        </span>
                        <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--brand)]">
                          -{YEARLY_DISCOUNT_PCT}%
                        </span>
                      </div>
                      <p className="tnum text-[11px] font-medium text-[var(--brand)]">
                        {isEn
                          ? `Billed ${p.formattedYearlyTotal}/yr`
                          : `Ditagih ${p.formattedYearlyTotal}/thn`}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                      {plan.priceUsdMonthly === 0
                        ? isEn
                          ? 'Free forever'
                          : 'Gratis selamanya'
                        : isEn
                          ? 'Billed monthly'
                          : 'Tagihan bulanan'}
                    </p>
                  )}
                </div>
                <p className="mt-1 min-h-[32px] text-[12px] text-[var(--text-muted)]">
                  {isEn ? plan.summaryEn : plan.summaryId}
                </p>

                <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--text-muted)]">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5">
                {isCurrent ? (
                  <Button size="sm" variant="secondary" fullWidth disabled>
                    {isEn ? 'Active Plan' : 'Paket Aktif Saat Ini'}
                  </Button>
                ) : planId === 'free' ? (
                  <Button size="sm" variant="ghost" fullWidth disabled>
                    {isEn ? 'Base Plan' : 'Paket Dasar'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    fullWidth
                    onClick={() => {
                      setCreatedOrder(null);
                      setCheckoutTier(planId);
                    }}
                  >
                    {isEn
                      ? `Upgrade to ${plan.labelEn}`
                      : `Upgrade ke ${plan.labelId}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      ) : (
        <div className="rounded-xl border border-[var(--brand)]/40 bg-[var(--surface-1)] p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand)]">
                <Building2 className="size-3.5" />
                {isEn ? 'Custom · > 15 Groups' : 'Pesanan Khusus · > 15 Grup'}
              </span>
              <h4 className="mt-2.5 text-[16px] font-bold text-[var(--text)]">
                Enterprise Custom
              </h4>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                {isEn
                  ? 'For companies needing more than 15 groups, custom features, dedicated approval flows, or private integrations.'
                  : 'Dirancang untuk pebisnis yang butuh lebih dari 15 grup, tambahan fitur sesuai alur kerja perusahaan, atau integrasi khusus.'}
              </p>
              <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--text-muted)]">
                {(isEn
                  ? [
                      'Unlimited / > 15 group workspaces',
                      'Custom feature development on request',
                      'Direct coordination with the founder',
                    ]
                  : [
                      'Kuota grup > 15 / sesuai skala perusahaan',
                      'Bisa request fitur tambahan khusus bisnismu',
                      'Koordinasi langsung dengan pengembang',
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-[var(--text-muted)]">
                Email:{' '}
                <a
                  href="mailto:stashinmeid@gmail.com?subject=Enterprise%20Custom%20stashinmeid"
                  className="font-semibold text-[var(--brand)] hover:underline"
                >
                  stashinmeid@gmail.com
                </a>
              </p>
            </div>

            <form
              onSubmit={handleSubmitEnterprise}
              className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4 lg:col-span-7"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="panel-ent-name"
                    className="text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Your Name' : 'Nama Lengkap'}
                  </label>
                  <input
                    id="panel-ent-name"
                    name="panelEntName"
                    value={entName}
                    onChange={(e) => setEntName(e.target.value)}
                    required
                    placeholder={isEn ? 'Your name' : 'Nama Anda'}
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="panel-ent-contact"
                    className="text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    Email / WhatsApp
                  </label>
                  <input
                    id="panel-ent-contact"
                    name="panelEntContact"
                    value={entContact}
                    onChange={(e) => setEntContact(e.target.value)}
                    required
                    placeholder="email@bisnis.com / 0812..."
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="panel-ent-company"
                    className="text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Company / Business' : 'Nama Perusahaan / Bisnis'}
                  </label>
                  <input
                    id="panel-ent-company"
                    name="panelEntCompany"
                    value={entCompany}
                    onChange={(e) => setEntCompany(e.target.value)}
                    placeholder={isEn ? 'e.g. Acme Holdings' : 'Mis. PT Nusantara'}
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="panel-ent-groups"
                    className="text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    {isEn ? 'Estimated Groups' : 'Estimasi Jumlah Grup'}
                  </label>
                  <select
                    id="panel-ent-groups"
                    name="panelEntGroups"
                    value={entGroups}
                    onChange={(e) => setEntGroups(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                  >
                    <option value="16 - 30 Grup">16 - 30 Grup</option>
                    <option value="30 - 50 Grup">30 - 50 Grup</option>
                    <option value="50+ / Unlimited">50+ / Unlimited</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="panel-ent-needs"
                  className="text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  {isEn
                    ? 'App Needs & Custom Feature Requests'
                    : 'Kebutuhan Aplikasi & Request Fitur Tambahan'}
                </label>
                <textarea
                  id="panel-ent-needs"
                  name="panelEntNeeds"
                  rows={3}
                  value={entNeeds}
                  onChange={(e) => setEntNeeds(e.target.value)}
                  required
                  placeholder={
                    isEn
                      ? 'Tell us what groups, workflows, or custom features your team needs...'
                      : 'Tulis kebutuhan aplikasi, jumlah grup/cabang, atau fitur tambahan yang ingin dibuatkan...'
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-1)] p-2.5 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                size="sm"
                fullWidth
                loading={entSending}
                icon={<Send className="size-3.5" />}
              >
                {isEn ? 'Send Enterprise Request' : 'Kirim Permintaan Enterprise'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Panel Admin: Permintaan Enterprise Custom Masuk */}
      {isAdmin && inquiries.length > 0 && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-[var(--brand)]" />
              <h4 className="text-[14px] font-semibold text-[var(--text)]">
                {isEn
                  ? 'Enterprise Custom Inquiries (Admin)'
                  : 'Permintaan Enterprise Custom Masuk (Admin)'}
              </h4>
            </div>
            <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]">
              {inquiries.length}
            </span>
          </div>

          <div className="mt-3 divide-y divide-[var(--line)]">
            {inquiries.map((inq) => (
              <div key={inq.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-[var(--text)]">
                      {inq.name}
                    </span>
                    {inq.company && inq.company !== '-' && (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        · {inq.company}
                      </span>
                    )}
                    <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                      {inq.groupEstimate}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        inq.status === 'new'
                          ? 'bg-[var(--due-soft)] text-[var(--due)]'
                          : inq.status === 'contacted'
                            ? 'bg-[var(--in-soft)] text-[var(--in)]'
                            : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                      }`}
                    >
                      {inq.status === 'new'
                        ? isEn
                          ? 'New'
                          : 'Baru'
                        : inq.status === 'contacted'
                          ? isEn
                            ? 'Contacted'
                            : 'Dihubungi'
                          : isEn
                            ? 'Closed'
                            : 'Selesai'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {inq.status === 'new' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleInquiryStatus(inq.id, 'contacted')}
                      >
                        {isEn ? 'Mark Contacted' : 'Tandai Dihubungi'}
                      </Button>
                    )}
                    {inq.status !== 'closed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInquiryStatus(inq.id, 'closed')}
                      >
                        {isEn ? 'Close' : 'Selesai'}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium text-[var(--brand)]">
                  {isEn ? 'Contact' : 'Kontak'}: {inq.contact}
                </p>
                <p className="rounded-lg bg-[var(--surface-2)]/70 p-2.5 text-[12px] leading-relaxed text-[var(--text)]">
                  {inq.requirements}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel Admin: Daftar Pembayaran Masuk & Aktivasi Paket */}
      {isAdmin && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[var(--brand)]" />
              <h4 className="text-[14px] font-semibold text-[var(--text)]">
                {isEn
                  ? 'Incoming Payments & Plan Activation (Admin)'
                  : 'Pembayaran Masuk & Aktivasi Paket (Admin)'}
              </h4>
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              Gateway: <strong className="uppercase">{paymentProvider}</strong>
            </span>
          </div>

          {orders.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-[var(--text-muted)]">
              {isEn
                ? 'No upgrade payments submitted yet.'
                : 'Belum ada pesanan upgrade yang masuk.'}
            </p>
          ) : (
            <div className="mt-3 divide-y divide-[var(--line)]">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--text)]">
                        {ord.userName}
                      </span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">
                        {ord.invoiceNo}
                      </span>
                      <span className="rounded bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--brand)]">
                        {ord.requestedTier} · {formatRp(ord.amountIdr)}
                      </span>
                      {ord.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--in-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--in)]">
                          <CheckCircle2 className="size-3" />
                          Aktif
                        </span>
                      )}
                      {ord.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--out-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--out)]">
                          <XCircle className="size-3" />
                          Ditolak
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {ord.userEmail} · {ord.paymentMethod} ({ord.paymentProvider}) ·{' '}
                      Ref: {ord.paymentRef}
                    </p>
                  </div>

                  {ord.status === 'pending' && (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        loading={busyOrderId === ord.id}
                        onClick={() => handleAdminAction(ord, 'approve')}
                      >
                        {isEn ? 'Activate Plan' : 'Aktifkan Paket'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyOrderId === ord.id}
                        onClick={() => handleAdminAction(ord, 'reject')}
                      >
                        {isEn ? 'Reject' : 'Tolak'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Checkout Pembayaran */}
      <Modal
        open={checkoutTier !== null}
        onClose={() => setCheckoutTier(null)}
        title={
          checkoutTier
            ? isEn
              ? `Upgrade to ${MEMBERSHIP_PLANS[checkoutTier].labelEn}`
              : `Upgrade ke Paket ${MEMBERSHIP_PLANS[checkoutTier].labelId}`
            : ''
        }
        description={
          isEn
            ? `Payment via ${paymentProvider.toUpperCase()} gateway. Admin will confirm & activate your plan.`
            : `Pembayaran lewat gateway ${paymentProvider.toUpperCase()}. Admin menerima notifikasi dan mengaktifkan paketmu.`
        }
        size="md"
        footer={
          createdOrder ? (
            <Button size="sm" onClick={() => setCheckoutTier(null)}>
              {isEn ? 'Done' : 'Selesai'}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCheckoutTier(null)}
              >
                {isEn ? 'Cancel' : 'Batal'}
              </Button>
              <Button size="sm" loading={submitting} onClick={handleCheckout}>
                {isEn ? 'Submit & Pay' : 'Buat Invoice & Bayar'}
              </Button>
            </>
          )
        }
      >
        {createdOrder ? (
          <div className="space-y-3 text-[13px]">
            <div className="rounded-xl border border-[var(--in)]/30 bg-[var(--in-soft)] p-3.5">
              <p className="font-semibold text-[var(--in)]">
                {isEn ? 'Invoice Created' : 'Invoice Berhasil Dibuat'}:{' '}
                {createdOrder.invoiceNo}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text)]">
                {isEn ? 'Amount' : 'Nominal'}:{' '}
                <strong>{formatRp(createdOrder.amountIdr)}</strong> ·{' '}
                {createdOrder.paymentMethod}
              </p>
            </div>
            {createdOrder.checkoutUrl ? (
              <a
                href={createdOrder.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-2.5 text-[13px] font-semibold text-[var(--brand-contrast)]"
              >
                {isEn ? 'Continue to Payment Gateway' : 'Lanjut Bayar di Payment Gateway'}
                <ExternalLink className="size-4" />
              </a>
            ) : (
              <p className="text-[12px] text-[var(--text-muted)]">
                {isEn
                  ? 'Your order has been sent to Admin with your reference note. Once confirmed, your group limit updates immediately.'
                  : 'Pesanan sudah masuk ke daftar Admin. Begitu pembayaran diverifikasi, kuota grupmu langsung aktif otomatis.'}
              </p>
            )}
          </div>
        ) : (
          checkoutTier && (
            <form onSubmit={handleCheckout} className="space-y-3.5">
              <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text)]">
                    {isEn
                      ? MEMBERSHIP_PLANS[checkoutTier].labelEn
                      : MEMBERSHIP_PLANS[checkoutTier].labelId}{' '}
                    ({isEn
                      ? MEMBERSHIP_PLANS[checkoutTier].badgeEn
                      : MEMBERSHIP_PLANS[checkoutTier].badgeId})
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Gateway: {paymentProvider.toUpperCase()} ·{' '}
                    {billingCycle === 'yearly'
                      ? isEn
                        ? 'Yearly (-20%)'
                        : 'Tahunan (-20%)'
                      : isEn
                        ? 'Monthly'
                        : 'Bulanan'}
                  </p>
                </div>
                <span className="tnum text-[16px] font-bold text-[var(--brand)]">
                  {(() => {
                    const cp = computePlanDisplayPricing({
                      plan: MEMBERSHIP_PLANS[checkoutTier],
                      cycle: billingCycle,
                      currency: primaryCurrency,
                      idrPerUnit,
                      locale: isEn ? 'en' : 'id',
                    });
                    return billingCycle === 'yearly'
                      ? cp.formattedYearlyTotal
                      : cp.formattedMonthlyEffective;
                  })()}
                </span>
              </div>

              <div>
                <label
                  htmlFor="membership-payment-method"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  {isEn ? 'Payment Method' : 'Metode Pembayaran'}
                </label>
                <select
                  id="membership-payment-method"
                  name="membershipPaymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                >
                  <option value="QRIS">QRIS (Semua E-Wallet &amp; Bank)</option>
                  <option value="Virtual Account">Virtual Account (BCA / Mandiri / BRI / BNI)</option>
                  <option value="E-Wallet">GoPay / OVO / DANA / ShopeePay</option>
                  <option value="Bank Transfer">Transfer Manual / Konfirmasi Admin</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="membership-payment-ref"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  {isEn
                    ? 'Sender Name / Payment Reference'
                    : 'Nama Pengirim / Nomor Referensi Pembayaran'}
                </label>
                <input
                  id="membership-payment-ref"
                  name="membershipPaymentRef"
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder={
                    isEn
                      ? 'e.g. John Doe · Ref #9921'
                      : 'Mis. Nama pengirim / nomor bukti transfer'
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--brand)] focus:outline-none"
                />
              </div>
            </form>
          )
        )}
      </Modal>
    </div>
  );
}
