"use client";

import { ReactNode } from "react";

const AFFILIATE_TAG = process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG;

export function AffiliateLink({
  asin,
  href,
  children,
  className = "font-medium text-blue-600 hover:underline",
}: {
  asin?: string;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const finalHref = asin
    ? `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}`
    : href;

  if (!finalHref) return <>{children}</>;

  return (
    <a
      href={finalHref}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
    >
      {children}
    </a>
  );
}

export function AffiliateCallout({
  title,
  description,
  cta,
  asin,
}: {
  title: string;
  description: string;
  cta: string;
  asin?: string;
}) {
  return (
    <div className="my-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="mb-2 text-base font-semibold text-amber-900">{title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-amber-800">
        {description}
      </p>
      <AffiliateLink
        asin={asin}
        className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        {cta}
      </AffiliateLink>
    </div>
  );
}
