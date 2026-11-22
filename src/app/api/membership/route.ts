import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import { notifyMany } from '@/lib/notifications';
import {
  MEMBERSHIP_PLANS,
  getMaxGroupsForTier,
  normalizeTier,
  type MembershipOrder,
  type MembershipTier,
} from '@/lib/membership';
import { mergeIntegrations } from '@/lib/integrations';

async function checkIsAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string
): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('stashinme_session')?.value;
  if (await verifySuperadminToken(token)) return true;

  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

async function getPrimaryAdminId(
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<string | null> {
  const superId = await getOrCreateSuperadminUserId();
  if (superId) return superId;
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function createThirdPartyCheckoutUrl(opts: {
  provider: string;
  environment: 'sandbox' | 'production';
  secretKey: string;
  invoiceNo: string;
  amountIdr: number;
  planName: string;
  customerEmail: string;
  customerName: string;
}): Promise<string | null> {
  if (!opts.secretKey) return null;

  try {
    if (opts.provider === 'midtrans') {
      const snapUrl =
        opts.environment === 'production'
          ? 'https://app.midtrans.com/snap/v1/transactions'
          : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
      const auth = Buffer.from(`${opts.secretKey}:`).toString('base64');
      const res = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          transaction_details: {
            order_id: opts.invoiceNo,
            gross_amount: opts.amountIdr,
          },
          item_details: [
            {
              id: opts.planName.toLowerCase(),
              price: opts.amountIdr,
              quantity: 1,
              name: `stashinmeid ${opts.planName} Membership`,
            },
          ],
          customer_details: {
            first_name: opts.customerName,
            email: opts.customerEmail,
          },
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { redirect_url?: string };
        return json.redirect_url || null;
      }
    }

    if (opts.provider === 'xendit') {
      const auth = Buffer.from(`${opts.secretKey}:`).toString('base64');
      const res = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: opts.invoiceNo,
          amount: opts.amountIdr,
          payer_email: opts.customerEmail,
          description: `stashinmeid ${opts.planName} Membership`,
          currency: 'IDR',
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { invoice_url?: string };
        return json.invoice_url || null;
      }
    }
  } catch {
    // Fallback ke konfirmasi manual jika gateway sandbox/key belum aktif
  }
  return null;
}

export async function GET() {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      tier: 'free',
      maxGroups: 3,
      ownedGroups: 0,
      isAdmin: false,
      pendingOrder: null,
      orders: [],
      paymentProvider: 'midtrans',
    });
  }

  const [isAdmin, userRes, groupCountRes, primaryAdminId] = await Promise.all([
    checkIsAdmin(admin, userId),
    admin.auth.admin.getUserById(userId),
    admin
      .from('finance_groups')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
    getPrimaryAdminId(admin),
  ]);

  const userMeta = (userRes.data?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const tier: MembershipTier = isAdmin
    ? normalizeTier(userMeta.membership_tier ?? 'enterprise')
    : normalizeTier(userMeta.membership_tier);

  let orders: MembershipOrder[] = [];
  let paymentProvider = 'midtrans';

  if (primaryAdminId) {
    const adminUser = await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminUser.data?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const integrations = mergeIntegrations(adminMeta.api_integrations);
    paymentProvider = integrations.payment.provider || 'midtrans';
    if (Array.isArray(adminMeta.membership_orders)) {
      orders = adminMeta.membership_orders as MembershipOrder[];
    }
  }

  const myOrders = orders.filter((o) => o.userId === userId);
  const pendingOrder = myOrders.find((o) => o.status === 'pending') ?? null;

  return NextResponse.json({
    tier,
    maxGroups: getMaxGroupsForTier(tier),
    ownedGroups: groupCountRes.count ?? 0,
    isAdmin,
    pendingOrder,
    myOrders,
    orders: isAdmin ? orders : [],
    paymentProvider,
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.' },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'checkout');
  const primaryAdminId = await getPrimaryAdminId(admin);

  if (!primaryAdminId) {
    return NextResponse.json(
      { error: 'Akun admin utama tidak ditemukan.' },
      { status: 500 }
    );
  }

  // ------------------------------------------------------------------
  // 1. User mengajukan upgrade paket via Payment Gateway / Konfirmasi
  // ------------------------------------------------------------------
  if (action === 'checkout') {
    const requestedTier =
      body.requestedTier === 'enterprise' ? 'enterprise' : 'pro';
    const paymentMethod = String(body.paymentMethod || 'QRIS / Virtual Account').trim();
    const paymentRef = String(body.paymentRef || '').trim();

    const [{ data: profile }, { data: authUser }, { data: adminAuth }] =
      await Promise.all([
        admin
          .from('profiles')
          .select('email, client_name')
          .eq('id', userId)
          .maybeSingle(),
        admin.auth.admin.getUserById(userId),
        admin.auth.admin.getUserById(primaryAdminId),
      ]);

    const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const integrations = mergeIntegrations(adminMeta.api_integrations);
    const paymentCfg = integrations.payment;
    const plan = MEMBERSHIP_PLANS[requestedTier];

    const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;
    const customerEmail =
      profile?.email || authUser?.user?.email || 'user@stashinmeid.app';
    const customerName =
      profile?.client_name || customerEmail.split('@')[0] || 'Pengguna';

    // Jika Admin sudah mengisi Secret Key Midtrans/Xendit di Pengaturan -> Koneksi API,
    // coba buat tautan pembayaran pihak ketiga sungguhan.
    const checkoutUrl = paymentCfg.enabled
      ? await createThirdPartyCheckoutUrl({
          provider: paymentCfg.provider,
          environment: paymentCfg.environment,
          secretKey: paymentCfg.secretKey,
          invoiceNo,
          amountIdr: plan.priceIdr,
          planName: plan.labelId,
          customerEmail,
          customerName,
        })
      : null;

    const order: MembershipOrder = {
      id: crypto.randomUUID(),
      invoiceNo,
      userId,
      userEmail: customerEmail,
      userName: customerName,
      requestedTier,
      amountIdr: plan.priceIdr,
      paymentProvider: paymentCfg.provider || 'midtrans',
      paymentMethod,
      paymentRef: paymentRef || 'Menunggu verifikasi pembayaran',
      checkoutUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const existingOrders = Array.isArray(adminMeta.membership_orders)
      ? (adminMeta.membership_orders as MembershipOrder[])
      : [];
    const nextOrders = [order, ...existingOrders].slice(0, 100);

    await admin.auth.admin.updateUserById(primaryAdminId, {
      user_metadata: {
        ...adminMeta,
        membership_orders: nextOrders,
      },
    });

    // Notifikasi langsung ke Admin supaya tahu siapa yang bayar & bisa segera aktifkan
    if (primaryAdminId !== userId) {
      await notifyMany(
        admin,
        [primaryAdminId],
        userId,
        'feed_post',
        `Pembayaran Upgrade ${plan.labelId}`,
        `${customerName} (${customerEmail}) mengajukan paket ${plan.labelId} · ${invoiceNo}`,
        'tab:settings'
      );
    }

    return NextResponse.json({
      ok: true,
      order,
      checkoutUrl,
    });
  }

  // ------------------------------------------------------------------
  // 2. Aksi Admin: Setujui / Tolak Order atau Ubah Paket User Langsung
  // ------------------------------------------------------------------
  const isAdmin = await checkIsAdmin(admin, userId);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (action === 'approve' || action === 'reject') {
    const orderId = String(body.orderId || '');
    const { data: adminAuth } = await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const existingOrders = Array.isArray(adminMeta.membership_orders)
      ? (adminMeta.membership_orders as MembershipOrder[])
      : [];
    const targetOrder = existingOrders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return NextResponse.json({ error: 'Order tidak ditemukan.' }, { status: 404 });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const nextOrders = existingOrders.map((o) =>
      o.id === orderId
        ? { ...o, status: nextStatus, updatedAt: new Date().toISOString() }
        : o
    );

    await admin.auth.admin.updateUserById(primaryAdminId, {
      user_metadata: {
        ...adminMeta,
        membership_orders: nextOrders,
      },
    });

    if (action === 'approve') {
      const { data: buyerAuth } = await admin.auth.admin.getUserById(
        targetOrder.userId
      );
      const buyerMeta = (buyerAuth?.user?.user_metadata ?? {}) as Record<
        string,
        unknown
      >;
      await admin.auth.admin.updateUserById(targetOrder.userId, {
        user_metadata: {
          ...buyerMeta,
          membership_tier: targetOrder.requestedTier,
          membership_activated_at: new Date().toISOString(),
        },
      });

      const plan = MEMBERSHIP_PLANS[targetOrder.requestedTier];
      await notifyMany(
        admin,
        [targetOrder.userId],
        userId,
        'connection_accepted',
        `Paket ${plan.labelId} Aktif`,
        `Upgrade ${plan.labelId} (maks. ${plan.maxGroups} grup) sudah diaktifkan admin.`,
        'tab:settings'
      );
    }

    return NextResponse.json({ ok: true, orders: nextOrders });
  }

  if (action === 'set_tier') {
    const targetUserId = String(body.targetUserId || '');
    const tier = normalizeTier(body.tier);
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId wajib diisi.' }, { status: 400 });
    }
    const { data: targetAuth } = await admin.auth.admin.getUserById(targetUserId);
    const targetMeta = (targetAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    await admin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...targetMeta,
        membership_tier: tier,
      },
    });
    return NextResponse.json({ ok: true, tier });
  }

  return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });
}
