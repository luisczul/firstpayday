import "server-only";
import { connect } from "node:http2";
import { createSign } from "node:crypto";
import { apnsBody, fcmMessage, type SubmissionPush } from "./payload";

// Apple (APNs, token auth) and Google (FCM HTTP v1) senders. Each is off until its
// credentials are in the server env; sending never throws.

export type SendResult = "sent" | "gone" | "failed" | "off";

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function jwt(header: object, claims: object, key: string, alg: "ES256" | "RS256"): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = createSign("SHA256");
  signer.update(input);
  const sig = signer.sign(alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key);
  return `${input}.${b64url(sig)}`;
}

const pem = (v: string) => v.replace(/\\n/g, "\n");

// ---- Apple ------------------------------------------------------------------
let apnsToken: { value: string; at: number } | null = null;

function apnsConfig() {
  const { APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY } = process.env;
  if (!APNS_KEY_ID || !APNS_TEAM_ID || !APNS_PRIVATE_KEY) return null;
  return {
    keyId: APNS_KEY_ID,
    teamId: APNS_TEAM_ID,
    key: pem(APNS_PRIVATE_KEY),
    topic: process.env.APNS_BUNDLE_ID || "app.firstpayday.ios",
    host: process.env.APNS_ENV === "development" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com",
  };
}

export async function sendApns(deviceToken: string, push: SubmissionPush): Promise<SendResult> {
  const cfg = apnsConfig();
  if (!cfg) return "off";
  try {
    // Apple wants a provider token no older than an hour (and not refreshed more than every 20 min).
    if (!apnsToken || Date.now() - apnsToken.at > 40 * 60_000) {
      apnsToken = { value: jwt({ alg: "ES256", kid: cfg.keyId }, { iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }, cfg.key, "ES256"), at: Date.now() };
    }
    const status = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const client = connect(cfg.host);
      client.on("error", reject);
      const req = client.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${apnsToken!.value}`,
        "apns-topic": cfg.topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      });
      let code = 0;
      let data = "";
      req.setTimeout(10_000, () => req.close());
      req.on("response", (h) => (code = Number(h[":status"])));
      req.on("data", (c) => (data += c));
      req.on("end", () => {
        client.close();
        let reason = "";
        try {
          reason = (JSON.parse(data || "{}") as { reason?: string }).reason ?? "";
        } catch {}
        resolve({ code, reason });
      });
      req.on("error", (e) => {
        client.close();
        reject(e);
      });
      req.end(JSON.stringify(apnsBody(push)));
    });
    if (status.code === 200) return "sent";
    if (status.code === 410 || status.reason === "BadDeviceToken" || status.reason === "Unregistered") return "gone";
    console.error("apns", status.code, status.reason);
    return "failed";
  } catch (e) {
    console.error("apns", e instanceof Error ? e.message : e);
    return "failed";
  }
}

// ---- Google -----------------------------------------------------------------
let fcmAccess: { value: string; until: number } | null = null;

function fcmConfig(): { projectId: string; email: string; key: string } | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!sa.client_email || !sa.private_key) return null;
    const projectId = process.env.FCM_PROJECT_ID || sa.project_id;
    return projectId ? { projectId, email: sa.client_email, key: pem(sa.private_key) } : null;
  } catch {
    return null;
  }
}

async function fcmAccessToken(cfg: { email: string; key: string }): Promise<string> {
  if (fcmAccess && Date.now() < fcmAccess.until) return fcmAccess.value;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt(
    { alg: "RS256", typ: "JWT" },
    { iss: cfg.email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    cfg.key,
    "RS256",
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`fcm oauth ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  fcmAccess = { value: body.access_token, until: Date.now() + (body.expires_in - 120) * 1000 };
  return body.access_token;
}

export async function sendFcm(deviceToken: string, push: SubmissionPush): Promise<SendResult> {
  const cfg = fcmConfig();
  if (!cfg) return "off";
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${await fcmAccessToken(cfg)}`, "content-type": "application/json" },
      body: JSON.stringify(fcmMessage(deviceToken, push)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "sent";
    const text = await res.text();
    if (res.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(text)) return "gone";
    console.error("fcm", res.status, text.slice(0, 300));
    return "failed";
  } catch (e) {
    console.error("fcm", e instanceof Error ? e.message : e);
    return "failed";
  }
}
