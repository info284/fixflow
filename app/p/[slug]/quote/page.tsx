import QuoteClient from "./QuoteClient";
import { createClient } from "@supabase/supabase-js";

type Trader = {
  id: string;
  slug: string | null;
  display_name: string | null;
  logo_url: string | null;
  headline: string | null;
};

async function getTrader(slug: string): Promise<Trader | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("id, slug, display_name, logo_url, headline")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getTrader error:", error.message);
    return null;
  }

  return data as Trader | null;
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trader = await getTrader(slug);

  return <QuoteClient slug={slug} initialTrader={trader} />;
}