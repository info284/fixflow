"use client";

import { useState } from "react";

export default function ReviewForm({ token }: { token: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submitReview() {
    setSaving(true);
    setError("");

    const res = await fetch("/api/reviews/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rating, comment }),
    });

    const json = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(json?.error || "Couldn’t save review");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <main className="ff-reviewPage">
        <div className="ff-reviewCard">
          <div className="ff-reviewEmoji">✅</div>
          <h1>Thank you</h1>
          <p>Your review has been saved.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ff-reviewPage">
      <div className="ff-reviewCard">
        <div className="ff-reviewBadge">FixFlow verified review</div>
        <h1>How did we do?</h1>
        <p>Your feedback helps real tradespeople build trust with future customers.</p>
<div className="ff-reviewTrust">
  ✔ Verified customer review linked to a completed job
</div>
        <div className="ff-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= rating ? "isActive" : ""}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional: tell us how the job went..."
        />

        {error ? <div className="ff-reviewError">{error}</div> : null}

        <button
          type="button"
          className="ff-reviewSubmit"
          onClick={submitReview}
          disabled={saving}
        >
          {saving ? "Saving..." : "Submit review"}
        </button>
      </div>

      <style jsx>{`
        .ff-reviewPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: #f6f8fc;
          color: #0b1320;
        }

        .ff-reviewCard {
          width: 100%;
          max-width: 520px;
          border: 1px solid #e6ecf5;
          border-radius: 28px;
          background: #ffffff;
          padding: 32px;
          box-shadow: 0 22px 60px rgba(15, 23, 42, 0.08);
          text-align: center;
        }

        .ff-reviewBadge {
          display: inline-flex;
          margin-bottom: 14px;
          padding: 7px 12px;
          border-radius: 999px;
          background: #eef4ff;
          color: #0b2a55;
          font-size: 12px;
          font-weight: 900;
        }

        h1 {
          margin: 0;
          font-size: 32px;
          letter-spacing: -0.04em;
        }

        p {
          margin: 10px auto 0;
          max-width: 390px;
          color: #5c6b84;
          line-height: 1.55;
        }

        .ff-stars {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 24px 0;
        }

        .ff-stars button {
          border: none;
          background: transparent;
          font-size: 40px;
          color: #d1d5db;
          cursor: pointer;
        }

        .ff-stars button.isActive {
          color: #f59e0b;
        }

        textarea {
          width: 100%;
          min-height: 130px;
          border: 1px solid #e6ecf5;
          border-radius: 18px;
          padding: 14px;
          resize: vertical;
          font-size: 14px;
          box-sizing: border-box;
        }

        .ff-reviewError {
          margin-top: 12px;
          color: #b91c1c;
          font-size: 13px;
          font-weight: 800;
        }

        .ff-reviewSubmit {
          width: 100%;
          height: 46px;
          margin-top: 16px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(135deg, #245BFF 0%, #0B2A55 100%);
          color: white;
          font-weight: 900;
          cursor: pointer;
        }

        .ff-reviewSubmit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
.ff-reviewTrust {
  margin-top: 14px;
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
  .ff-stars button:hover {
  transform: scale(1.08);
}

.ff-stars button {
  transition: transform 0.15s ease;
}
        .ff-reviewEmoji {
          font-size: 42px;
          margin-bottom: 12px;
        }
      `}</style>
    </main>
  );
}