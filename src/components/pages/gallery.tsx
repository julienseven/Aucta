'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import styles from './gallery.module.css';

const FALLBACK_IMAGE = '/images/camera.png';

function imageLabel(alt: string, index: number, count: number) {
  return count > 1 ? `${alt}, image ${index + 1} of ${count}` : alt;
}

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const sources = images.length ? images : [FALLBACK_IMAGE];
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const zoomTriggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const swipeStartX = useRef<number | null>(null);
  const titleId = useId();
  const selectedIndex = Math.min(index, sources.length - 1);
  const current = sources[selectedIndex]!;
  const currentFailed = failed.has(current);
  const currentLoaded = loaded.has(current);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = zoomTriggerRef.current;
    if (!lightboxOpen || !dialog) return;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      opener?.focus();
    };
  }, [lightboxOpen]);

  const select = useCallback((nextIndex: number) => {
    const count = sources.length;
    setIndex((nextIndex + count) % count);
  }, [sources.length]);

  const move = useCallback((direction: -1 | 1) => {
    select(selectedIndex + direction);
  }, [select, selectedIndex]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'ArrowLeft' && sources.length > 1) {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight' && sources.length > 1) {
      event.preventDefault();
      move(1);
    }
  };

  const handleThumbnailKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, thumbnail: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowLeft') nextIndex = (thumbnail - 1 + sources.length) % sources.length;
    if (event.key === 'ArrowRight') nextIndex = (thumbnail + 1) % sources.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = sources.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    select(nextIndex);
    thumbnailRefs.current[nextIndex]?.focus();
  };

  const beginSwipe = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeStartX.current = event.clientX;
  };

  const endSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStartX.current;
    swipeStartX.current = null;
    if (start == null || sources.length < 2) return;
    const distance = event.clientX - start;
    if (Math.abs(distance) >= 40) move(distance > 0 ? -1 : 1);
  };

  const markLoaded = (source: string) => {
    setLoaded((previous) => new Set(previous).add(source));
  };

  const markFailed = (source: string) => {
    setFailed((previous) => new Set(previous).add(source));
  };

  return (
    <section className={`${styles.root} gallery`} aria-label="Auction images">
      <div data-gallery-frame className={styles.mainFrame} onPointerDown={beginSwipe} onPointerUp={endSwipe} onPointerCancel={() => { swipeStartX.current = null; }}>
        {!currentLoaded && !currentFailed && (
          <span className={styles.loading} role="status">Loading image…</span>
        )}
        {currentFailed ? (
          <div className={styles.fallback} role="img" aria-label={`Image unavailable for ${alt}`}>
            <span>Image unavailable</span>
          </div>
        ) : (
          <Image
            key={current}
            src={current}
            alt={imageLabel(alt, selectedIndex, sources.length)}
            fill
            priority={selectedIndex === 0}
            sizes="(max-width: 959px) 100vw, 58vw"
            className={currentLoaded ? styles.imageLoaded : styles.imageLoading}
            onLoad={() => markLoaded(current)}
            onError={() => markFailed(current)}
          />
        )}
        <button
          ref={zoomTriggerRef}
          type="button"
          className={styles.zoomButton}
          aria-label={`Open ${imageLabel(alt, selectedIndex, sources.length)} full screen`}
          onClick={() => setLightboxOpen(true)}
          disabled={currentFailed}
        >
          <ZoomIn aria-hidden="true" size={18} />
          <span>View larger</span>
        </button>
        {sources.length > 1 && (
          <div className={styles.mainControls} aria-label="Image navigation">
            <button type="button" aria-label="Previous image" onClick={() => move(-1)}>
              <ChevronLeft aria-hidden="true" size={21} />
            </button>
            <span aria-live="polite" aria-atomic="true">{selectedIndex + 1} / {sources.length}</span>
            <button type="button" aria-label="Next image" onClick={() => move(1)}>
              <ChevronRight aria-hidden="true" size={21} />
            </button>
          </div>
        )}
      </div>

      {sources.length > 1 && (
        <div className={styles.thumbnails} role="group" aria-label="Choose an image">
          {sources.map((src, thumbnail) => (
            <button
              ref={(element) => { thumbnailRefs.current[thumbnail] = element; }}
              key={`${src}-${thumbnail}`}
              type="button"
              className={styles.thumbnail}
              aria-label={`Show image ${thumbnail + 1} of ${sources.length}`}
              aria-pressed={thumbnail === selectedIndex}
              onClick={() => select(thumbnail)}
              onKeyDown={(event) => handleThumbnailKeyDown(event, thumbnail)}
            >
              {failed.has(src) ? (
                <span className={styles.thumbnailFallback} aria-hidden="true">Unavailable</span>
              ) : (
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="76px"
                  onLoad={() => markLoaded(src)}
                  onError={() => markFailed(src)}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          closeLightbox();
        }}
        onClose={closeLightbox}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id={titleId} className={styles.srOnly}>Full-screen auction image</h2>
        <button ref={closeRef} type="button" className={styles.closeButton} onClick={closeLightbox}>
          <X aria-hidden="true" size={22} />
          <span>Close</span>
        </button>
        <div className={styles.lightboxImage} onPointerDown={beginSwipe} onPointerUp={endSwipe} onPointerCancel={() => { swipeStartX.current = null; }}>
          {currentFailed ? (
            <div className={styles.fallback} role="img" aria-label={`Image unavailable for ${alt}`}>
              <span>Image unavailable</span>
            </div>
          ) : (
            <Image
              key={`lightbox-${current}`}
              src={current}
              alt={imageLabel(alt, selectedIndex, sources.length)}
              fill
              sizes="100vw"
              onLoad={() => markLoaded(current)}
              onError={() => markFailed(current)}
            />
          )}
        </div>
        {sources.length > 1 && (
          <div className={styles.lightboxControls}>
            <button type="button" onClick={() => move(-1)} aria-label="Previous image">
              <ChevronLeft aria-hidden="true" size={24} />
              <span>Previous</span>
            </button>
            <span aria-live="polite" aria-atomic="true">Image {selectedIndex + 1} of {sources.length}</span>
            <button type="button" onClick={() => move(1)} aria-label="Next image">
              <span>Next</span>
              <ChevronRight aria-hidden="true" size={24} />
            </button>
          </div>
        )}
      </dialog>}
    </section>
  );
}
