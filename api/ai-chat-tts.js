// api/ai-chat-tts.js
//
// TTS endpoint for Vercel serverless functions
// Uses Google Cloud Text-to-Speech with Service Account auth
// Free tier: 4 million characters/month (Neural2 voices)
//

async function getAccessToken(serviceAccountJson) {
  const sa = JSON.parse(serviceAccountJson);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Encode header and payload
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import the private key
  const pemBody = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyBuffer = Buffer.from(pemBody, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput)
  );
  const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err.slice(0, 200)}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

function createWavHeader(audioDataLength) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46); // RIFF
  view.setUint32(4, 36 + audioDataLength, true);
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45); // WAVE
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20); // fmt
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61); // data
  view.setUint32(40, audioDataLength, true);

  return Buffer.from(header);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return res.status(500).json({ error: "Google Service Account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON in environment variables." });
  }

  const { text, voice } = typeof req.body === "object" ? req.body : (() => {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  })();

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' field" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "Text too long (max 5000 characters)" });
  }

  try {
    const accessToken = await getAccessToken(serviceAccountJson);

    const ttsRes = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "en-US",
            name: voice,
          },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 24000,
            speakingRate: 0.88,
            effectsProfileId: ["large-home-entertainment-class-device"],
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("Google TTS error:", err);
      return res.status(ttsRes.status).json({ error: `TTS API error: ${ttsRes.status} — ${err.slice(0, 200)}` });
    }

    const data = await ttsRes.json();
    const base64Audio = data.audioContent;

    if (!base64Audio) {
      return res.status(502).json({ error: "No audio content in response" });
    }

    const audioBuffer = Buffer.from(base64Audio, "base64");
    const wavHeader = createWavHeader(audioBuffer.length);
    const wavData = Buffer.concat([wavHeader, audioBuffer]);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", wavData.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Accept-Ranges", "bytes");

    return res.send(wavData);
  } catch (err) {
    console.error("TTS handler error:", err.message);
    return res.status(502).json({ error: "TTS service failed: " + err.message });
  }
}
