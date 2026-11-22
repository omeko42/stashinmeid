import type { Locale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateSuperadminUserId } from '@/lib/superadminUser';
import { verifySuperadminToken } from '@/lib/jwt';
import DashboardClient from '@/components/DashboardClient';
import { LandingPage } from '@/components/auth/LandingPage';
import { DashboardSkeleton } from '@/components/shell/DashboardSkeleton';
import type { Transaction, Debt } from '@/types/finance';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

async function DashboardLoader({ locale }: { locale: Locale }) {
  setRequestLocale(locale);
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('stashinme_session')?.value;
  const superadminSession = await verifySuperadminToken(sessionToken);

  if (superadminSession) {
    let loadedData: {
      transactions: Transaction[];
      debts: Debt[];
      userEmail: string;
      clientName: string;
      bio: string;
      avatarUrl: string | null;
      bannerUrl: string | null;
      impersonatingEmail: string | null;
    } | null = null;

    try {
      const adminClient = createAdminClient();
      const targetUserId =
        superadminSession.impersonateUserId || (await getOrCreateSuperadminUserId());

      if (adminClient && targetUserId) {
        const { data: memberships } = await adminClient
          .from('finance_group_members')
          .select('group_id')
          .eq('user_id', targetUserId)
          .eq('status', 'active');
        const groupIds = (memberships ?? []).map((m) => m.group_id).filter(Boolean);
        const scopeFilter =
          groupIds.length > 0
            ? `user_id.eq.${targetUserId},group_id.in.(${groupIds.join(',')})`
            : `user_id.eq.${targetUserId}`;

        const [{ data: profile }, { data: transactions }, { data: debts }] = await Promise.all([
          adminClient
            .from('profiles')
            .select('email, client_name, bio, avatar_url, banner_url')
            .eq('id', targetUserId)
            .single(),
          adminClient
            .from('transactions')
            .select('*')
            .or(scopeFilter)
            .order('transaction_date', { ascending: false }),
          adminClient
            .from('debts')
            .select('*')
            .or(scopeFilter)
            .order('created_at', { ascending: false }),
        ]);

        loadedData = {
          transactions: (transactions as Transaction[]) || [],
          debts: (debts as Debt[]) || [],
          userEmail:
            superadminSession.impersonateEmail ?? profile?.email ?? superadminSession.sub,
          clientName:
            superadminSession.impersonateClientName ??
            profile?.client_name ??
            'Superadmin Personal',
          bio: (profile?.bio as string) || '',
          avatarUrl: (profile?.avatar_url as string) || null,
          bannerUrl: (profile?.banner_url as string) || null,
          impersonatingEmail: superadminSession.impersonateEmail ?? null,
        };
      }
    } catch (err) {
      console.error('[stashinmeid] superadmin loader error:', err);
    }

    if (loadedData) {
      return (
        <DashboardClient
          initialTransactions={loadedData.transactions}
          initialDebts={loadedData.debts}
          userEmail={loadedData.userEmail}
          clientName={loadedData.clientName}
          userRole="admin"
          initialBio={loadedData.bio}
          initialAvatarUrl={loadedData.avatarUrl}
          initialBannerUrl={loadedData.bannerUrl}
          isDemoMode={false}
          isSuperadmin={true}
          impersonatingEmail={loadedData.impersonatingEmail}
        />
      );
    }

    // Superadmin tetap masuk dashboard meski data belum ada. Yang penting
    // jangan jatuh ke mode demo: data contoh menyesatkan karena terlihat
    // seperti data asli padahal tidak ada di database.
    return (
      <DashboardClient
        initialTransactions={[]}
        initialDebts={[]}
        userEmail={superadminSession.sub}
        clientName="Superadmin Workspace"
        userRole="admin"
        isDemoMode={false}
        isSuperadmin={true}
        impersonatingEmail={null}
      />
    );
  }

  const supabase = await createClient();

  if (!supabase) {
    // Env Supabase belum diset (mis. di Vercel). Tampilkan kondisi ini secara
    // terbuka, bukan data contoh - data contoh terlihat seperti data asli.
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-16 text-center text-[var(--text-muted)]">
        <p className="text-[13px] font-semibold text-[var(--text)]">
          Database belum terhubung
        </p>
        <p className="mt-2 text-[12px]">
          Variabel lingkungan Supabase (NEXT_PUBLIC_SUPABASE_URL dan
          NEXT_PUBLIC_SUPABASE_ANON_KEY) belum diset untuk environment ini.
        </p>
      </div>
    );
  }

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error('[stashinmeid] auth getUser error:', err);
  }

  if (!user) {
    return <LandingPage defaultModalOpen={false} />;
  } else {
    let profile: Record<string, unknown> | null = null;
    let transactions: Transaction[] = [];
    let debts: Debt[] = [];

    try {
      const [profileRes, txRes, debtRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('client_name, role, bio, avatar_url, banner_url')
          .eq('id', user.id)
          .single(),
        supabase
          .from('transactions')
          .select('*')
          .order('transaction_date', { ascending: false }),
        supabase
          .from('debts')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);
      profile = (profileRes.data as Record<string, unknown> | null) ?? null;
      transactions = (txRes.data as Transaction[]) || [];
      debts = (debtRes.data as Debt[]) || [];
    } catch (err) {
      console.error('[stashinmeid] user dashboard loader error:', err);
    }

    return (
      <DashboardClient
        initialTransactions={transactions}
        initialDebts={debts}
        userEmail={user.email ?? null}
        clientName={(profile?.client_name as string) ?? 'Personal'}
        userRole={(profile?.role as 'admin' | 'user') ?? 'user'}
        initialBio={(profile?.bio as string) || ''}
        initialAvatarUrl={(profile?.avatar_url as string) || null}
        initialBannerUrl={(profile?.banner_url as string) || null}
        isDemoMode={false}
      />
    );
  }
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = routing.locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : routing.defaultLocale;
  setRequestLocale(locale);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text-muted)]">
          <main className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8">
            <DashboardSkeleton />
          </main>
        </div>
      }
    >
      <DashboardLoader locale={locale} />
    </Suspense>
  );
}
