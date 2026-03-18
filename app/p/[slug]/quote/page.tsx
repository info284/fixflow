import QuoteClient from "./QuoteClient";

type Trader = {
  id?: string;
  slug?: string;
  display_name?: string;
  business_name?: string;
  headline?: string;
  logo_url?: string;
  accent?: string;
};

async function getTrader(slug: string): Promise<Trader | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/trades/by-slug?slug=${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

  const json = await res.json();
  return json.trader ?? null;
}

export default async function Page({
  params,
}: any) {
  const trader = await getTrader(params.slug);

  return <QuoteClient slug={params.slug} initialTrader={trader} />;
}