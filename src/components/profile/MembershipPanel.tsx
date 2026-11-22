'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  MEMBERSHIP_PLANS,
  type MembershipOrder,
  type MembershipTier,
} from '@/lib/membership';
import { formatRp } from '@/lib/format';

export function MembershipPanel() {
  const locale = useLocale();
  const isEn = locale === 'en';

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<MembershipTier>('free');
  const [maxGroups, setMaxGroups] = useState(3);
  const [ownedGroups, setOwnedGroups] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('midtrans');
  const [pendingOrder, setPendingOrder] = useState<MembershipOrder | null>(null);
  const [orders, setOrders] = useState<MembershipOrder[]>([]);

  // Checkout Modal State
  const [checkoutTier, setCheckoutTier] = useState<'pro' | 'enterprise' | null>(
    null
  );
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
    orderId: string,
    action: 'approve' | 'reject'
  ) => {
    setBusyOrderId(orderId);
    try {
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderId }),
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

      {/* 3 Pilihan Paket Membership */}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        {(['free', 'pro', 'enterprise'] as MembershipTier[]).map((planId) => {
          const plan = MEMBERSHIP_PLANS[planId];
          const isCurrent = tier === planId;
          const features = isEn ? plan.featuresEn : plan.featuresId;
          const priceLabel = isEn
            ? plan.priceUsd === 0
              ? '$0'
              : `$${plan.priceUsd}/mo`
            : plan.priceIdr === 0
              ? 'Rp 0'
              : `${formatRp(plan.priceIdr)}/bln`;

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
                  <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
                    {isEn ? plan.badgeEn : plan.badgeId}
                  </span>
                </div>

                <p className="tnum mt-2 text-[22px] font-bold text-[var(--text)]">
                  {priceLabel}
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
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
                        onClick={() => handleAdminAction(ord.id, 'approve')}
                      >
                        {isEn ? 'Activate Plan' : 'Aktifkan Paket'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyOrderId === ord.id}
                        onClick={() => handleAdminAction(ord.id, 'reject')}
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
                    Gateway: {paymentProvider.toUpperCase()}
                  </p>
                </div>
                <span className="tnum text-[16px] font-bold text-[var(--brand)]">
                  {formatRp(MEMBERSHIP_PLANS[checkoutTier].priceIdr)}
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
