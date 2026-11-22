import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import { mergeIntegrations } from '@/lib/integrations';
import {
  MEMBERSHIP_PLANS,
  type MembershipOrder,
} from '@/lib/membership';
import { notifyMany } from '@/lib/notifications';

/**
 * Webhook penerima notifikasi pembayaran pihak ketiga (Midtrans / Xendit / Stripe).
 * Daftarkan URL ini di dashboard provider:
 *   https://stashinmeid.vercel.app/api/membership/webhook
 *
 * Saat transaksi dinyatakan lunas (settlement / capture / PAID / checkout.session.completed),
 * paket membership pembeli otomatis aktif dan admin + pembeli langsung menerima notifikasi.
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server belum siap.' }, { status: 500 });
  }

  const superId = await getOrCreateSuperadminUserId();
  if (!superId) {
    return NextResponse.json({ error: 'Admin tidak ditemukan.' }, { status: 500 });
  }

  const { data: adminAuth } = await admin.auth.admin.getUserById(superId);
  const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const paymentCfg = mergeIntegrations(adminMeta.api_integrations).payment;

  const rawBody = await req.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // 1. Deteksi provider & validasi ringan token/signature jika webhookSecret diisi
  let invoiceNo = '';
  let isPaid = false;

  // Midtrans HTTP Notification
  if (typeof body.order_id === 'string' && typeof body.transaction_status === 'string') {
    invoiceNo = body.order_id;
    const status = body.transaction_status;
    const fraud = String(body.fraud_status || 'accept');

    if (paymentCfg.secretKey && typeof body.signature_key === 'string') {
      const expected = createHash('sha512')
        .update(
          `${body.order_id}${body.status_code ?? ''}${body.gross_amount ?? ''}${paymentCfg.secretKey}`
        )
        .digest('hex');
      if (expected !== body.signature_key) {
        return NextResponse.json({ error: 'Invalid Midtrans signature' }, { status: 401 });
      }
    }

    isPaid =
      status === 'settlement' || (status === 'capture' && fraud === 'accept');
  }
  // Xendit Invoice Callback
  else if (typeof body.external_id === 'string' && typeof body.status === 'string') {
    const callbackToken = req.headers.get('x-callback-token') || '';
    if (paymentCfg.webhookSecret && callbackToken !== paymentCfg.webhookSecret) {
      return NextResponse.json({ error: 'Invalid Xendit callback token' }, { status: 401 });
    }
    invoiceNo = body.external_id;
    isPaid = body.status.toUpperCase() === 'PAID' || body.status.toUpperCase() === 'SETTLED';
  }
  // Stripe Checkout Session Completed
  else if (body.type === 'checkout.session.completed' && body.data && typeof body.data === 'object') {
    const session = (body.data as { object?: Record<string, unknown> }).object ?? {};
    invoiceNo = String(session.client_reference_id || '');
    isPaid = session.payment_status === 'paid';
  }

  if (!invoiceNo) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!isPaid) {
    return NextResponse.json({ ok: true, invoiceNo, status: 'not_paid_yet' });
  }

  const existingOrders = Array.isArray(adminMeta.membership_orders)
    ? (adminMeta.membership_orders as MembershipOrder[])
    : [];
  const target = existingOrders.find((o) => o.invoiceNo === invoiceNo);
  if (!target) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'order_not_found' });
  }

  if (target.status === 'approved') {
    return NextResponse.json({ ok: true, invoiceNo, alreadyApproved: true });
  }

  const nextOrders = existingOrders.map((o) =>
    o.id === target.id
      ? {
          ...o,
          status: 'approved' as const,
          paymentRef: `${o.paymentRef} · Auto-verified via webhook`,
          updatedAt: new Date().toISOString(),
        }
      : o
  );

  await admin.auth.admin.updateUserById(superId, {
    user_metadata: {
      ...adminMeta,
      membership_orders: nextOrders,
    },
  });

  const { data: buyerAuth } = await admin.auth.admin.getUserById(target.userId);
  const buyerMeta = (buyerAuth?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  await admin.auth.admin.updateUserById(target.userId, {
    user_metadata: {
      ...buyerMeta,
      membership_tier: target.requestedTier,
      membership_activated_at: new Date().toISOString(),
    },
  });

  const plan = MEMBERSHIP_PLANS[target.requestedTier];
  await notifyMany(
    admin,
    [target.userId, superId],
    superId,
    'connection_accepted',
    `Pembayaran Lunas · Paket ${plan.labelId}`,
    `${target.userName} (${invoiceNo}) otomatis aktif ke paket ${plan.labelId} (maks. ${plan.maxGroups} grup).`,
    'tab:settings'
  );

  return NextResponse.json({ ok: true, invoiceNo, activatedTier: target.requestedTier });
}
