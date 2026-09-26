import { ImageResponse } from "next/og";

export const alt = "First Payday: the chore chart that pays your kids";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  const cards = [
    ["🧽", "Baseboards", "$5 / floor", "#B8431F"],
    ["🚗", "Car mats", "$5", "#E08A1E"],
    ["🍖", "Barbecue", "$8", "#7A3B4A"],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FBF3E4", padding: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#B8431F", fontSize: 40, fontWeight: 800 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#B8431F", color: "#F2C14E", display: "flex", alignItems: "center", justifyContent: "center" }}>$</div>
          First Payday
        </div>
        <div style={{ marginTop: 36, fontSize: 76, fontWeight: 900, color: "#3B2418", lineHeight: 1.05, display: "flex" }}>The chore chart that pays your kids.</div>
        <div style={{ marginTop: 16, fontSize: 32, color: "#7A5A48", display: "flex" }}>First kid free · kids tap, you approve, they save</div>
        <div style={{ marginTop: 44, display: "flex", gap: 24 }}>
          {cards.map(([emoji, title, price, color]) => (
            <div key={title} style={{ display: "flex", flexDirection: "column", width: 300, height: 170, background: "#FFFAF1", borderRadius: 28, borderLeft: `14px solid ${color}`, padding: 22, position: "relative" }}>
              <div style={{ position: "absolute", right: 18, top: 16, background: "#F2C14E", borderRadius: 99, padding: "6px 14px", fontSize: 24, fontWeight: 900 }}>{price}</div>
              <div style={{ fontSize: 56, display: "flex" }}>{emoji}</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#3B2418", display: "flex" }}>{title}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
