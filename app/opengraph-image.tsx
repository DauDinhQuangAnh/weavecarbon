import { ImageResponse } from "next/og";

export const alt = "WeaveCarbon - Industrial carbon & climate data infrastructure";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0f2e1d 0%, #1f5a37 60%, #2f7a4a 100%)",
          color: "#ffffff"
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 6, color: "#b9f6a3" }}>INDUSTRIAL CARBON DATA INFRASTRUCTURE</div>
        <div style={{ fontSize: 96, fontWeight: 700, marginTop: 24 }}>WeaveCarbon</div>
        <div style={{ fontSize: 38, marginTop: 24, color: "#dcefe2" }}>
          Measure at source · Sign at the device · Trace every number
        </div>
      </div>
    ),
    size
  );
}
