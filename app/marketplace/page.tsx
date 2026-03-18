import { Suspense } from "react";
import MarketplaceClient from "./MarketplaceClient";

export const dynamic = "force-dynamic";

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <MarketplaceClient />
    </Suspense>
  );
}