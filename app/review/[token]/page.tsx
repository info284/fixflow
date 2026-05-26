"use client";

import { useEffect, useState } from "react";

type ReviewRequest = {
  id: string;
  customer_name: string | null;
  trader_id: string;
  request_id: string | null;
  profiles?: {
    business_name: string | null;
    display_name: string | null;
  } | null;
};

export default function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const p = await params;
      setToken(p.token);

      const res = await fetch(`/api/reviews/${p.token}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || "This review link is no longer valid.");
      } else {
        setReview(json.review);
      }

      setLoading(false);
    }

    load();
  }, [params]);

  async function submitReview() {
    if (!token) return;

    try {
      setSending(true);
      setError("");

      const res = await fetch(`/api/reviews/${token}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          comment,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Couldn’t submit review");
      }

      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Couldn’t submit review");
    } finally {
      setSending(false);
    }
  }

  const businessName =
    review?.profiles?.business_name ||
    review?.profiles?.display_name ||
    "your trader";

  if (loading) {
    return <main style={styles.page}>Loading review...</main>;
  }

  if (error && !review) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Review link unavailable</h1>
          <p style={styles.text}>{error}</p>
        </section>
      </main>
    );
  }

  if (done) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.title}>Thank you</h1>
          <p style={styles.text}>
            Your review has been submitted and will help other customers choose
            {` ${businessName}`}.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.badge}>Verified FixFlow review</div>

        <h1 style={styles.title}>How was your experience?</h1>

        <p style={styles.text}>
          Leave a quick review for <strong>{businessName}</strong>.
        </p>

        <div style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              style={{
                ...styles.starButton,
                opacity: star <= rating ? 1 : 0.25,
              }}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell others what the trader helped with..."
          style={styles.textarea}
        />

        {error ? <p style={styles.error}>{error}</p> : null}

        <button
          type="button"
          onClick={submitReview}
          disabled={sending}
          style={styles.button}
        >
          {sending ? "Submitting..." : "Submit review"}
        </button>

        <p style={styles.footer}>Powered by FixFlow</p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F6F8FC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#FFFFFF",
    border: "1px solid #E4EAF5",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0 24px 70px rgba(15, 35, 70, 0.12)",
    textAlign: "center",
  },
  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#EEF4FF",
    color: "#245BFF",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 16,
  },
  title: {
    margin: 0,
    color: "#102A56",
    fontSize: 28,
    lineHeight: 1.15,
  },
  text: {
    color: "#5C6B84",
    fontSize: 16,
    lineHeight: 1.6,
  },
  stars: {
    display: "flex",
    justifyContent: "center",
    gap: 6,
    margin: "22px 0",
  },
  starButton: {
    border: 0,
    background: "transparent",
    color: "#F5B301",
    fontSize: 42,
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    borderRadius: 18,
    border: "1px solid #DDE6F4",
    padding: 14,
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    width: "100%",
    border: 0,
    borderRadius: 999,
    padding: "15px 20px",
    marginTop: 18,
    background: "#245BFF",
    color: "#FFFFFF",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
  footer: {
    marginTop: 18,
    color: "#94A3B8",
    fontSize: 13,
  },
  error: {
    color: "#B42318",
    fontSize: 14,
  },
};