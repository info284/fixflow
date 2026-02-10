"use client";

export default function Error({
error,
reset,
}: {
error: Error & { digest?: string };
reset: () => void;
}) {
return (
<div style={{ padding: 24 }}>
<h2 style={{ fontSize: 18, fontWeight: 600 }}>
Something went wrong
</h2>

<p style={{ marginTop: 8, color: "#555" }}>
{error?.message || "Unknown error"}
</p>

<button
onClick={() => reset()}
style={{
marginTop: 16,
border: "1px solid #ccc",
padding: "8px 12px",
borderRadius: 8,
cursor: "pointer",
}}
>
Try again
</button>
</div>
);
}