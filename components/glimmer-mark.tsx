export function GlimmerMark({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="relative inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        letterSpacing: "0.12em",
        textIndent: "0.12em",
      }}
    >
      G
      <svg
        width={size * 0.28}
        height={size * 0.28}
        viewBox="0 0 24 24"
        fill="currentColor"
        className="absolute -top-1 -right-1"
      >
        <path d="M12 2c.7 4.8 2.2 7.6 3.4 8.6 1.2 1 4.3 2.4 8.6 3.4-4.3 1-7.4 2.4-8.6 3.4-1.2 1-2.7 3.8-3.4 8.6-.7-4.8-2.2-7.6-3.4-8.6-1.2-1-4.3-2.4-8.6-3.4 4.3-1 7.4-2.4 8.6-3.4 1.2-1 2.7-3.8 3.4-8.6z" />
      </svg>
    </span>
  );
}

export function Sparkle({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 2c.7 4.8 2.2 7.6 3.4 8.6 1.2 1 4.3 2.4 8.6 3.4-4.3 1-7.4 2.4-8.6 3.4-1.2 1-2.7 3.8-3.4 8.6-.7-4.8-2.2-7.6-3.4-8.6-1.2-1-4.3-2.4-8.6-3.4 4.3-1 7.4-2.4 8.6-3.4 1.2-1 2.7-3.8 3.4-8.6z" />
    </svg>
  );
}
