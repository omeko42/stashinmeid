export function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo-icon.png"
      alt="stashinmeid logo"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 object-contain drop-shadow-md"
    />
  );
}
