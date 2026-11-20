import { createAdminClient } from '@/lib/supabase/admin';

export async function getOrCreateSuperadminUserId(): Promise<string | null> {
  const admin = createAdminClient();
  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  if (!admin || !superadminEmail) return null;

  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find((u) => u.email === superadminEmail);
  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: superadminEmail,
    password: crypto.randomUUID() + 'Aa1!',
    email_confirm: true,
    user_metadata: {
      role: 'admin',
    },
  });

  if (error || !created.user) return null;
  return created.user.id;
}
