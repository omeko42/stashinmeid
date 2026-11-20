export function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl overflow-hidden shadow-md bg-emerald-600"
    >
      <img
        src="/logo-icon.png"
        alt="stashinmeid logo"
        className="w-full h-full object-cover scale-[1.18]"
      />
    </div>
  );
}
