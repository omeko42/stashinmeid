import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCallerUserId } from '@/lib/currentUser';
import { verifySuperadminToken } from '@/lib/jwt';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import { notifyMany } from '@/lib/notifications';
import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_TIER_ORDER,
  addMonthsIso,
  getMaxGroupsForTier,
  getPlanPrice,
  mergePlansWithOverrides,
  normalizeTier,
  resolveMembershipStatus,
  type BillingCycle,
  type EnterpriseInquiry,
  type MembershipOrder,
  type MembershipTier,
  type PlanOverridesMap,
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
  amountUsd: number;
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
              id: opts.planName.toLowerCase().replace(/\s+/g, '-'),
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

    if (opts.provider === 'stripe') {
      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('client_reference_id', opts.invoiceNo);
      params.set('customer_email', opts.customerEmail);
      params.set('success_url', 'https://stashinme.biz.id/?payment=success');
      params.set('cancel_url', 'https://stashinme.biz.id/?payment=cancelled');
      params.set('line_items[0][quantity]', '1');
      params.set('line_items[0][price_data][currency]', 'usd');
      params.set(
        'line_items[0][price_data][unit_amount]',
        String(Math.max(100, Math.round(opts.amountUsd * 100)))
      );
      params.set(
        'line_items[0][price_data][product_data][name]',
        `stashinmeid ${opts.planName} Membership`
      );
      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (res.ok) {
        const json = (await res.json()) as { url?: string };
        return json.url || null;
      }
    }
  } catch {
    // Fallback ke konfirmasi manual jika gateway sandbox/key belum aktif
  }
  return null;
}

export async function GET(req: NextRequest) {
  const isPublicQuery = req.nextUrl.searchParams.get('public') === '1';
  const admin = createAdminClient();
  const primaryAdminId = admin ? await getPrimaryAdminId(admin) : null;

  let planOverrides: PlanOverridesMap = {};
  let adminMeta: Record<string, unknown> = {};
  if (admin && primaryAdminId) {
    const adminUser = await admin.auth.admin.getUserById(primaryAdminId);
    adminMeta = (adminUser.data?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    if (adminMeta.plan_overrides && typeof adminMeta.plan_overrides === 'object') {
      planOverrides = adminMeta.plan_overrides as PlanOverridesMap;
    }
  }

  if (isPublicQuery) {
    return NextResponse.json({
      planOverrides,
      plans: mergePlansWithOverrides(planOverrides),
    });
  }

  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!admin) {
    return NextResponse.json({
      tier: 'free',
      maxGroups: 3,
      ownedGroups: 0,
      isAdmin: false,
      pendingOrder: null,
      orders: [],
      paymentProvider: 'midtrans',
      planOverrides: {},
    });
  }

  const [isAdmin, userRes, groupCountRes] = await Promise.all([
    checkIsAdmin(admin, userId),
    admin.auth.admin.getUserById(userId),
    admin
      .from('finance_groups')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
  ]);

  const userMeta = (userRes.data?.user?.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const membershipStatus = resolveMembershipStatus(userMeta, isAdmin);
  const tier: MembershipTier = membershipStatus.effectiveTier;
  const effectivePlans = mergePlansWithOverrides(planOverrides);

  let orders: MembershipOrder[] = [];
  let inquiries: EnterpriseInquiry[] = [];
  let paymentProvider = 'midtrans';

  if (primaryAdminId) {
    const integrations = mergeIntegrations(adminMeta.api_integrations);
    paymentProvider = integrations.payment.provider || 'midtrans';
    if (Array.isArray(adminMeta.membership_orders)) {
      orders = adminMeta.membership_orders as MembershipOrder[];
    }
    if (Array.isArray(adminMeta.enterprise_inquiries)) {
      inquiries = adminMeta.enterprise_inquiries as EnterpriseInquiry[];
    }
  }

  const myOrders = orders.filter((o) => o.userId === userId);
  const pendingOrder = myOrders.find((o) => o.status === 'pending') ?? null;

  return NextResponse.json({
    tier,
    storedTier: membershipStatus.storedTier,
    expiresAt: membershipStatus.expiresAt,
    durationMonths: membershipStatus.durationMonths,
    note: membershipStatus.note,
    isExpired: membershipStatus.isExpired,
    daysLeft: membershipStatus.daysLeft,
    maxGroups: effectivePlans[tier]?.maxGroups ?? getMaxGroupsForTier(tier),
    ownedGroups: groupCountRes.count ?? 0,
    isAdmin,
    pendingOrder,
    myOrders,
    orders: isAdmin ? orders : [],
    inquiries: isAdmin ? inquiries : [],
    paymentProvider,
    planOverrides,
    plans: effectivePlans,
  });
}

export async function POST(req: NextRequest) {
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
  // 0. Permintaan Enterprise Custom (boleh dari Landing Page tanpa login)
  // ------------------------------------------------------------------
  if (action === 'enterprise_inquiry') {
    const name = String(body.name || '').trim().slice(0, 120);
    const contact = String(body.contact || '').trim().slice(0, 160);
    const company = String(body.company || '').trim().slice(0, 140);
    const groupEstimate = String(body.groupEstimate || '> 9 grup').trim().slice(0, 60);
    const requirements = String(body.requirements || '').trim().slice(0, 1500);

    if (!name || !contact || !requirements) {
      return NextResponse.json(
        { error: 'Nama, kontak (email/WA), dan kebutuhan aplikasi wajib diisi.' },
        { status: 400 }
      );
    }

    const { data: adminAuth } = await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const existingInquiries = Array.isArray(adminMeta.enterprise_inquiries)
      ? (adminMeta.enterprise_inquiries as EnterpriseInquiry[])
      : [];

    const inquiry: EnterpriseInquiry = {
      id: crypto.randomUUID(),
      name,
      contact,
      company: company || '-',
      groupEstimate,
      requirements,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    const nextInquiries = [inquiry, ...existingInquiries].slice(0, 100);
    await admin.auth.admin.updateUserById(primaryAdminId, {
      user_metadata: {
        ...adminMeta,
        enterprise_inquiries: nextInquiries,
      },
    });

    const callerId = await getCallerUserId();
    await notifyMany(
      admin,
      [primaryAdminId],
      callerId || primaryAdminId,
      'feed_post',
      `Permintaan Enterprise: ${company || name}`,
      `${name} (${contact}) · ${groupEstimate} — ${requirements.slice(0, 140)}`,
      'tab:settings'
    );

    return NextResponse.json({ ok: true, inquiry });
  }

  const userId = await getCallerUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ------------------------------------------------------------------
  // 1. User mengajukan upgrade paket via Payment Gateway / Konfirmasi
  // ------------------------------------------------------------------
  if (action === 'checkout') {
    const rawTier = String(body.requestedTier || 'standard');
    const requestedTier: Exclude<MembershipTier, 'free'> =
      rawTier === 'business' || rawTier === 'enterprise'
        ? 'business'
        : rawTier === 'pro'
          ? 'pro'
          : 'standard';
    const billingCycle: BillingCycle =
      body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
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
    const effectivePlans = mergePlansWithOverrides(
      (adminMeta.plan_overrides as PlanOverridesMap) ?? null
    );
    const plan = effectivePlans[requestedTier] ?? MEMBERSHIP_PLANS[requestedTier];
    const pricing = getPlanPrice(plan, billingCycle);

    const invoiceNo = `INV-${Date.now().toString(36).toUpperCase()}`;
    const customerEmail =
      profile?.email || authUser?.user?.email || 'user@stashinmeid.app';
    const customerName =
      profile?.client_name || customerEmail.split('@')[0] || 'Pengguna';

    // Jika Admin sudah mengisi Secret Key Midtrans/Xendit/Stripe di Pengaturan -> Koneksi API,
    // buat tautan pembayaran pihak ketiga sungguhan.
    const checkoutUrl = paymentCfg.enabled
      ? await createThirdPartyCheckoutUrl({
          provider: paymentCfg.provider,
          environment: paymentCfg.environment,
          secretKey: paymentCfg.secretKey,
          invoiceNo,
          amountIdr: pricing.idrTotalBilled,
          amountUsd: pricing.usdTotalBilled,
          planName: `${plan.labelEn} (${billingCycle})`,
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
      billingCycle,
      amountIdr: pricing.idrTotalBilled,
      amountUsd: pricing.usdTotalBilled,
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
      const durationMonths = targetOrder.billingCycle === 'yearly' ? 12 : 1;
      await admin.auth.admin.updateUserById(targetOrder.userId, {
        user_metadata: {
          ...buyerMeta,
          membership_tier: targetOrder.requestedTier,
          membership_duration_months: durationMonths,
          membership_expires_at: addMonthsIso(durationMonths),
          membership_note: `Invoice ${targetOrder.invoiceNo}`,
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

  if (action === 'save_plan_overrides') {
    const rawOverrides = (body.planOverrides ?? {}) as PlanOverridesMap;
    const cleaned: PlanOverridesMap = {};
    for (const tier of MEMBERSHIP_TIER_ORDER) {
      const ov = rawOverrides[tier];
      if (!ov) continue;
      cleaned[tier] = {
        maxGroups:
          typeof ov.maxGroups === 'number' && ov.maxGroups >= 1
            ? Math.min(999, Math.round(ov.maxGroups))
            : MEMBERSHIP_PLANS[tier].maxGroups,
        priceIdrMonthly:
          tier === 'free'
            ? 0
            : typeof ov.priceIdrMonthly === 'number' && ov.priceIdrMonthly >= 0
              ? Math.round(ov.priceIdrMonthly)
              : MEMBERSHIP_PLANS[tier].priceIdrMonthly,
        priceUsdMonthly:
          tier === 'free'
            ? 0
            : typeof ov.priceUsdMonthly === 'number' && ov.priceUsdMonthly >= 0
              ? Math.round(ov.priceUsdMonthly)
              : MEMBERSHIP_PLANS[tier].priceUsdMonthly,
      };
    }

    const { data: adminAuth } = await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    await admin.auth.admin.updateUserById(primaryAdminId, {
      user_metadata: {
        ...adminMeta,
        plan_overrides: cleaned,
      },
    });
    return NextResponse.json({
      ok: true,
      planOverrides: cleaned,
      plans: mergePlansWithOverrides(cleaned),
    });
  }

  if (action === 'update_inquiry_status') {
    const inquiryId = String(body.inquiryId || '');
    const status =
      body.status === 'closed'
        ? 'closed'
        : body.status === 'contacted'
          ? 'contacted'
          : 'new';
    const { data: adminAuth } = await admin.auth.admin.getUserById(primaryAdminId);
    const adminMeta = (adminAuth?.user?.user_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const existingInquiries = Array.isArray(adminMeta.enterprise_inquiries)
      ? (adminMeta.enterprise_inquiries as EnterpriseInquiry[])
      : [];
    const nextInquiries = existingInquiries.map((inq) =>
      inq.id === inquiryId ? { ...inq, status } : inq
    );
    await admin.auth.admin.updateUserById(primaryAdminId, {
      user_metadata: {
        ...adminMeta,
        enterprise_inquiries: nextInquiries,
      },
    });
    return NextResponse.json({ ok: true, inquiries: nextInquiries });
  }

  return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });
}
