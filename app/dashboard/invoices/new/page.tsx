import { Suspense } from "react";
import NewInvoiceClient from "./NewInvoiceClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <NewInvoiceClient />
    </Suspense>
  );
}