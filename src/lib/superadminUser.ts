import { createAdminClient } from '@/lib/supabase/admin';

const SUPERADMIN_EMAIL = 'superadmin@stashinmeid.local';

export async function getOrCreateSuperadminUserId(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find((u) => u.email === SUPERADMIN_EMAIL);
  if (existing) return existing.id;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: crypto.randomUUID() + 'Aa1!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Superadmin',
      client_name: 'Superadmin Personal',
      role: 'admin',
    },
  });

  if (error || !created.user) return null;
  return created.user.id;
}
