import { createAdminClient } from '@/lib/supabase/admin';

export async function getOrCreateSuperadminUserId(): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const explicitEmail = process.env.SUPERADMIN_EMAIL?.trim();
  if (explicitEmail) {
    const { data: profileByEmail } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', explicitEmail)
      .maybeSingle();
    if (profileByEmail?.id) return profileByEmail.id;
  }

  // Prioritaskan akun admin nyata yang sudah terdaftar di profiles
  // (mis. akun pemilik utama) agar login via SUPERADMIN_USERNAME tidak
  // membuat akun bayangan baru <username>@stashinmeid.id.
  const { data: existingAdmins } = await admin
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .order('created_at', { ascending: true });

  if (existingAdmins && existingAdmins.length > 0) {
    const realAdmin =
      existingAdmins.find((a) => !a.email?.endsWith('@stashinmeid.id')) ??
      existingAdmins[0];
    if (realAdmin?.id) return realAdmin.id;
  }

  const envUsername = process.env.SUPERADMIN_USERNAME?.trim();
  const superadminEmail =
    explicitEmail || (envUsername ? `${envUsername}@stashinmeid.id` : null);
  if (!superadminEmail) return null;

  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === superadminEmail.toLowerCase()
  );
  if (existing) {
    return existing.id;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: superadminEmail,
    password: crypto.randomUUID() + 'Aa1!',
    email_confirm: true,
    user_metadata: {
      full_name: envUsername || 'Superadmin',
      client_name: envUsername ? `${envUsername} (Superadmin)` : 'Superadmin',
      role: 'admin',
    },
  });

  if (error || !created.user) return null;
  return created.user.id;
}
