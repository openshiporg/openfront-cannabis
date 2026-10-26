'use client';

import { useEffect, useRef, useState } from 'react';

type Chapter = { id: string; label: string; count: number; ink: string };

/** Pinned under the header: every chapter on the page, with the one being read marked. */
export function ChapterRail({ chapters }: { chapters: Chapter[] }) {
  const [current, setCurrent] = useState(chapters[0]?.id ?? '');
  const rail = useRef<HTMLElement>(null);

  useEffect(() => {
    const sections = chapters.map(chapter => document.getElementById(chapter.id)).filter((node): node is HTMLElement => Boolean(node));
    if (!sections.length) return;
    // A chapter is current once its band has reached the rail; the last one passed wins.
    const update = () => {
      const line = (rail.current?.getBoundingClientRect().bottom ?? 112) + 8;
      let active = sections[0].id;
      for (const section of sections) if (section.getBoundingClientRect().top <= line) active = section.id;
      setCurrent(active);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [chapters]);

  // Keep the current chapter visible inside the rail by scrolling the rail only, never the page.
  useEffect(() => {
    const strip = rail.current?.firstElementChild as HTMLElement | null;
    const item = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !item) return;
    const left = item.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + item.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: Math.max(0, left - 16) });
  }, [current]);

  if (chapters.length < 2) return null;
  return <nav ref={rail} aria-label="Chapters" className="sticky top-[var(--cn-header)] z-30 border-b border-cn-line bg-cn-bg">
    <div className="cn-scroll mx-auto flex h-[var(--cn-rail)] max-w-[1440px] items-center gap-6 overflow-x-auto px-4 sm:px-6">
      {chapters.map(chapter => <a key={chapter.id} href={`#${chapter.id}`} aria-current={current === chapter.id ? 'true' : undefined} className="cn-tab">
        <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: chapter.ink }} />{chapter.label}<span className="cn-num text-[13px] font-normal text-cn-ink-3">{chapter.count}</span>
      </a>)}
    </div>
  </nav>;
}
