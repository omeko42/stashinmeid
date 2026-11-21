'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Loader2, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (password.length < 8) {
      setMsg({ type: 'error', text: 'Password minimal 8 karakter.' });
      return;
    }
    if (password !== confirm) {
      setMsg({ type: 'error', text: 'Konfirmasi password tidak cocok.' });
      return;
    }

    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setMsg({ type: 'error', text: 'Supabase belum dikonfigurasi.' });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Password berhasil diperbarui! Mengarahkan ke login...' });
      setTimeout(() => router.push('/login'), 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <BrandLogo size={42} />
          <div>
            <h1 className="text-lg font-bold lowercase">stashinmeid</h1>
            <p className="text-xs text-zinc-400">Buat Password Baru</p>
          </div>
        </div>

        {msg && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              msg.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}
          >
            {msg.text}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Password Baru</label>
            <PasswordInput
              unstyled
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Ulangi Password Baru</label>
            <PasswordInput
              unstyled
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi password"
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Simpan Password Baru
          </button>
        </form>
      </div>
    </div>
  );
}
