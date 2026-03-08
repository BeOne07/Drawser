import { HTMLAttributes, PropsWithChildren } from 'react';

type GlassCardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export function GlassCard({ children, className = '', ...rest }: GlassCardProps) {
  return (
    <div className={`glass rounded-2xl border border-white/10 p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}
