"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2.5rem 1.5rem",
            background: "linear-gradient(180deg, #eef6f0 0%, #f7f5ec 100%)",
            color: "#020617",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center"
          }}
        >
          <section
            style={{
              maxWidth: "36rem",
              width: "100%",
              borderRadius: "2rem",
              border: "1px solid rgba(255,255,255,0.7)",
              background: "rgba(255,255,255,0.85)",
              padding: "2.5rem",
              boxShadow: "0 28px 90px rgba(32,72,48,0.12)"
            }}
          >
            <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
              Ứng dụng gặp sự cố nghiêm trọng
            </h1>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "#475569", marginBottom: "2rem" }}>
              Rất tiếc, WeaveCarbon không thể tải được. Vui lòng thử tải lại trang, nếu lỗi vẫn tiếp diễn hãy liên hệ đội hỗ trợ.
            </p>
            {error.digest ? (
              <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "1.5rem" }}>
                Mã lỗi: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                borderRadius: "1rem",
                background: "#059669",
                color: "#fff",
                padding: "0.75rem 1.5rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 18px 40px rgba(5,150,105,0.22)"
              }}
            >
              Tải lại trang
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
