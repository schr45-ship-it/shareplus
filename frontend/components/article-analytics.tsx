"use client";

import { useEffect } from "react";

export function ArticleTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    let cancelled = false;

    const track = async () => {
      try {
        await fetch("/api/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId }),
        });
      } catch {
        // Silent fail — analytics should not break the article page
      }
    };

    const timer = setTimeout(() => {
      if (!cancelled) track();
    }, 1000); // basic engagement threshold

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [articleId]);

  return null;
}

export function SourceLinkTracker({
  articleId,
  href,
  children,
  className,
}: {
  articleId: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const handleClick = async () => {
    try {
      await fetch("/api/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
    } catch {
      // Silent fail
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
