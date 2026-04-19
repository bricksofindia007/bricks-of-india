interface Props {
  height?: number;
  className?: string;
}

/**
 * Brand signature element — tricolour stripe using Indian flag colours.
 * Default height 12px (homepage hero); use height={4} on inner page headers.
 */
export function TricolourStripe({ height = 12, className = '' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        height: `${height}px`,
        flexShrink: 0,
        background:
          'repeating-linear-gradient(90deg, #FFC72C 0 40px, #E30613 40px 80px, #FFFFFF 80px 120px, #138808 120px 160px)',
      }}
    />
  );
}
