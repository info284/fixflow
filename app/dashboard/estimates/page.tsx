import { Suspense } from "react";
import EstimatesClient from "./EstimatesClient";

export const dynamic = "force-dynamic"; // ✅ allowed here (server file)

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <EstimatesClient />
    </Suspense>
  );
}