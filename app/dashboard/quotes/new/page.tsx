import { Suspense } from "react";
import NewQuoteClient from "./NewQuoteClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <NewQuoteClient />
    </Suspense>
  );
}