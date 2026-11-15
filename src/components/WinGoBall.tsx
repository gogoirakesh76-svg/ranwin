interface WinGoBallProps {
  digit: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function WinGoBall({ digit, size = 'md' }: WinGoBallProps) {
  const sizeClass =
    size === 'xs'
      ? 'w-6 h-6 text-xs'
      : size === 'sm'
      ? 'w-8 h-8 text-sm'
      : size === 'lg'
      ? 'w-12 h-12 text-xl'
      : 'w-10 h-10 text-base';

  // Color rules:
  // 0: Red + Violet
  // 5: Green + Violet
  // 1,3,7,9: Green
  // 2,4,6,8: Red
  let outerGradient = '';
  let innerBorder = '';
  if (digit === 0) {
    outerGradient = 'bg-[linear-gradient(135deg,#EF4444_50%,#8B5CF6_50%)]';
    innerBorder = 'ring-red-200';
  } else if (digit === 5) {
    outerGradient = 'bg-[linear-gradient(135deg,#10B981_50%,#8B5CF6_50%)]';
    innerBorder = 'ring-emerald-200';
  } else if (digit % 2 === 1) {
    outerGradient = 'bg-gradient-to-br from-emerald-400 to-emerald-600';
    innerBorder = 'ring-emerald-200';
  } else {
    outerGradient = 'bg-gradient-to-br from-rose-400 to-red-600';
    innerBorder = 'ring-rose-200';
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${sizeClass} ${outerGradient} p-[3px] shadow-sm ring-1 ${innerBorder} shrink-0 select-none`}
    >
      <span className="w-full h-full rounded-full bg-white/90 flex items-center justify-center font-display font-bold text-slate-900 leading-none">
        {digit}
      </span>
    </span>
  );
}
