'use client';

import { useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/Segmented';
import { KolegaSection } from '@/components/profile/KolegaSection';
import type { KolegaApi } from '@/hooks/useKolega';

export type SocialSub = 'kolega' | 'chat' | 'feed';

interface SocialTabProps {
  sub: SocialSub;
  onSubChange: (sub: SocialSub) => void;
  kolega: KolegaApi;
}

/**
 * Lapisan sosial stashinmeid.
 *
 * Tiga permukaan: Kolega (ruang keuangan bersama), Obrolan (perpesanan
 * antar pengguna), dan Feed (postingan). Kolega memakai section yang sama
 * dengan menu Profil agar tidak ada dua sumber kebenaran.
 */
export function SocialTab({ sub, onSubChange, kolega }: SocialTabProps) {
  const tSos = useTranslations('sosial');

  const options = [
    { value: 'kolega' as const, label: tSos('kolega') },
    { value: 'chat' as const, label: tSos('chat') },
    { value: 'feed' as const, label: tSos('feed') },
  ];

  return (
    <div className="space-y-5">
      <Segmented
        options={options}
        value={sub}
        onChange={(v) => onSubChange(v as SocialSub)}
        ariaLabel={tSos('title')}
      />

      {sub === 'kolega' && <KolegaSection kolega={kolega} />}
      {sub === 'chat' && null /* dipasang pada commit Obrolan */}
      {sub === 'feed' && null /* dipasang pada commit Feed */}
    </div>
  );
}
