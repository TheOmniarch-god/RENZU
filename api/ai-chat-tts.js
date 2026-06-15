// api/ai-chat-tts.js
//
// Separate TTS endpoint for Vercel serverless functions
// Handles Google Gemini text-to-speech requests
//

function createWavHeader(audioDataLength) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF descriptor
  view.setUint8(0, 0x52); // 'R'
  view.setUint8(1, 0x49); // 'I'
  view.setUint8(2, 0x46); // 'F'
  view.setUint8(3, 0x46); // 'F'
  view.setUint32(4, 36 + audioDataLength, true);

  // RIFF type
  view.setUint8(8, 0x57);  // 'W'
  view.setUint8(9, 0x41);  // 'A'
  view.setUint8(10, 0x56); // 'V'
  view.setUint8(11, 0x45); // 'E'

  // fmt sub-chunk
  view.setUint8(12, 0x66); // 'f'
  view.setUint8(13, 0x6d); // 'm'
  view.setUint8(14, 0x74); // 't'
  view.setUint8(15, 0x20); // ' '
  view.setUint32(16, 16, true);

  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  view.setUint8(36, 0x64); // 'd'
  view.setUint8(37, 0x61); // 'a'
  view.setUint8(38, 0x74); // 't'
  view.setUint8(39, 0x61); // 'a'
  view.setUint32(40, audioDataLength, true);

  return Buffer.from(header);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: "Gemini TTS not configured. Set GEMINI_API_KEY in environment variables." });
  }

  const { text, voice } = typeof req.body === "object" ? req.body : (() => {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  })();

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' field" });
  }

  try {
    const ttsRes = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: text },
          voice: {
            languageCode: "en-US",
            name: voice === "male" ? "en-US-Neural2-C" : "en-US-Neural2-A"
          },
          audioConfig: {
            audioEncoding: "LINEAR16",
            sampleRateHertz: 24000,
            pitch: voice === "male" ? -5 : 0,
            speakingRate: 0.92
          }
        })
      }
    );

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("Gemini TTS error:", err);
      throw new Error(`TTS failed: ${ttsRes.status}`);
    }

    const data = await ttsRes.json();
    const base64Audio = data.audioContent;
    if (!base64Audio) throw new Error("No audio content in response");

    const audioBuffer = Buffer.from(base64Audio, "base64");
    const wavHeader = createWavHeader(audioBuffer.length);
    const wavData = Buffer.concat([wavHeader, audioBuffer]);

    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-cache");
    return res.send(wavData);
  } catch (err) {
    console.error("TTS error:", err.message);
    return res.status(502).json({ error: "TTS service failed: " + err.message });
  }
}
