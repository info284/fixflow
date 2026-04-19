import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type Trader = {
  id: string;
  slug: string | null;
  display_name: string | null;
  business_name?: string | null;
  headline: string | null;
  logo_url: string | null;
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ job?: string }>;
};

async function getTrader(slug: string): Promise<Trader | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("profiles")
    .select("id, slug, display_name, business_name, headline, logo_url")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getTrader error:", error.message);
    return null;
  }

  return data as Trader | null;
}

export default async function QuoteSuccessPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { job } = await searchParams;

  const trader = await getTrader(slug);
  const traderName =
    trader?.display_name || trader?.business_name || slug.replace(/-/g, " ");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(143,169,214,0.10),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(143,169,214,0.05),transparent_40%),#f4f7fb] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-[28px] border border-[rgba(230,236,245,0.95)] bg-[rgba(255,255,255,0.96)] shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_16px_36px_rgba(15,23,42,0.06)]">
          <div
            className="absolute inset-x-0 top-0"
            style={{
              height: 3,
              background:
                "linear-gradient(90deg, rgba(143,169,214,0.78), rgba(143,169,214,0.22), rgba(143,169,214,0))",
            }}
          />

          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -top-28 -left-28 h-80 w-80 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(143,169,214,0.14), transparent 60%)",
              }}
            />
            <div
              className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(143,169,214,0.08), transparent 60%)",
              }}
            />
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/70 to-transparent" />
          </div>

          <div className="relative border-b border-[rgba(230,236,245,0.95)] bg-[linear-gradient(135deg,rgba(220,232,250,0.34),rgba(255,255,255,0.96))] px-6 py-6 sm:px-7">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(143,169,214,0.22)] bg-white shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_10px_24px_rgba(15,23,42,0.05)]">
                {trader?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={trader.logo_url}
                    alt={traderName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[18px] font-extrabold text-[#1F355C]">
                    {(traderName?.[0] || "T").toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[rgba(31,53,92,0.58)]">
                  FixFlow confirmation
                </div>
                <h1 className="mt-1 text-[27px] font-extrabold tracking-tight text-[#1F355C] sm:text-[30px]">
                  Request sent successfully
                </h1>
                <p className="mt-3 text-[15px] leading-7 text-[rgba(31,53,92,0.72)]">
                  Your request has been sent directly to{" "}
                  <span className="font-semibold text-[#1F355C]">
                    {traderName}
                  </span>
                  . They’ll review the details and may contact you shortly.
                </p>

                {job ? (
                  <div className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[13px] font-bold text-emerald-800">
                    Job reference: {job}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative px-6 py-6 sm:px-7">
            <div className="rounded-[22px] border border-[rgba(230,236,245,0.95)] bg-[rgba(248,251,255,0.85)] px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
              <h2 className="text-[16px] font-extrabold text-[#1F355C]">
                What happens next
              </h2>

              <div className="mt-4 space-y-3 text-[14.5px] text-[rgba(31,53,92,0.72)]">
                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[rgba(143,169,214,0.85)]" />
                  <p>The trader reviews your request and any photos attached.</p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[rgba(143,169,214,0.85)]" />
                  <p>They may contact you by email or phone for more detail.</p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 rounded-full bg-[rgba(143,169,214,0.85)]" />
                  <p>You may receive a quote or a site visit offer next.</p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[22px] border border-[rgba(230,236,245,0.95)] bg-white px-5 py-5 shadow-[0_1px_0_rgba(255,255,255,0.75)_inset]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(31,53,92,0.54)]">
                Need anything else?
              </div>

              <p className="mt-2 text-[14.5px] leading-7 text-[rgba(31,53,92,0.72)]">
                You can send another request if you need to add more information.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/p/${slug}/quote`}
                  className="rounded-[18px] border border-[rgba(230,236,245,0.95)] bg-white px-5 py-3 text-[14.5px] font-semibold text-[#1F355C] transition hover:bg-[rgba(248,251,255,0.9)]"
                >
                  Send another request
                </Link>

                <Link
                  href="/"
                  className="rounded-[18px] bg-[linear-gradient(180deg,#223B67_0%,#1A2F52_100%)] px-5 py-3 text-[14.5px] font-semibold text-white shadow-[0_16px_32px_rgba(31,53,92,0.20),inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:-translate-y-[1px] hover:brightness-[1.02]"
                >
                  Back to site
                </Link>
              </div>
            </div>

            <p className="mt-6 text-[13.5px] text-[rgba(31,53,92,0.54)]">
              You can now close this page.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}