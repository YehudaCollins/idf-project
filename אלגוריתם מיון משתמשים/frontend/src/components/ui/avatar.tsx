import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { safeImageSrc } from '../../lib/safeImageSrc';

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  className,
}: {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`
      : name.slice(0, 2);
  const src = safeImageSrc(imageUrl);
  const showImage = !!src && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft font-bold text-accent ring-1 ring-teal-100',
        sizes[size],
        className
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}
