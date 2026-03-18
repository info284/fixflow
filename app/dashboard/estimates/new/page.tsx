import { Suspense } from "react";
import NewEstimateClient from "./NewEstimateClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <NewEstimateClient />
    </Suspense>
  );
}