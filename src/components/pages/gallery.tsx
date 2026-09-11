'use client';
import { useState } from 'react';
import Image from 'next/image';

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const sources = images.length ? images : ['/images/camera.png'];
  const [index, setIndex] = useState(0);
  const current = sources[Math.min(index, sources.length - 1)]!;

  return (
    <div className="gallery">
      <div className="gallery-main">
        <Image src={current} alt={alt} fill priority sizes="(max-width: 800px) 100vw, 58vw" />
      </div>
      {sources.length > 1 && (
        <div className="thumbs">
          {sources.map((src, thumb) => (
            <button
              key={`${src}-${thumb}`}
              type="button"
              aria-label={`Show image ${thumb + 1}`}
              aria-pressed={thumb === index}
              onClick={() => setIndex(thumb)}
            >
              <Image src={src} alt="" fill sizes="88px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
