import { Suspense } from "react";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading inbox…</div>}>
      <InboxClient />
    </Suspense>
  );
}