import { BrandLoader } from '@/components/ui/BrandLoader';
import { DashboardSkeleton } from '@/components/shell/DashboardSkeleton';

export default function Loading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-10 lg:px-8">
      <BrandLoader size="lg" label="Memuat workspace stashinmeid..." />
      <DashboardSkeleton className="mt-4 opacity-75" />
    </div>
  );
}
