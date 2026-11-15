"use client";

import { useEffect, useState } from "react";

export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => setFailedSrc(null), [src]);
  const showImage = Boolean(src && failedSrc !== src);
  const initial = name?.trim().slice(0, 1).toLocaleUpperCase("es-ES") || "J";

  return <span className={className} role="img" aria-label={name ? `Avatar de ${name}` : "Avatar"}>
    {showImage ? <img src={src!} alt="" onError={() => setFailedSrc(src!)} /> : <span className="avatar-fallback" aria-hidden="true">{initial}</span>}
  </span>;
}
