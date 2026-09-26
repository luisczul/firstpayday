import { ImageResponse } from "next/og";

// PWA / home-screen icons drawn on the fly: a maple-red tile with a gold coin.
const SIZES = new Set([180, 192, 512]);

export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(req.url).searchParams.has("maskable");
  const coin = Math.round(size * (maskable ? 0.46 : 0.58));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#B8431F",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: coin,
            height: coin,
            borderRadius: coin,
            background: "#F2C14E",
            border: `${Math.max(4, size * 0.03)}px solid #FBF3E4`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#7A3B4A",
            fontSize: coin * 0.62,
            fontWeight: 900,
          }}
        >
          $
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
