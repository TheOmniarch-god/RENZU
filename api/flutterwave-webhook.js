import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORDS = {
  gu_master: [
    "reputationgu", "wineorigin", "faithlight", "strengthpath",
    "aperturefist", "primevalseed", "wisdomchain", "firststepper"
  ],
  gu_immortal: [
    "northdarkice", "soulseal", "weboffate", "ordinaryabyss",
    "dreamwalker", "immortalaperture", "fateweaver", "freedomseeker"
  ],
  venerable: [
    "reverendinsanity", "heavenpursuit", "strongeatweak", "selftrue",
    "peakvenerable", "fatebows", "lightningwill", "renzuascendant"
  ],
};

const TIER_NAMES = {
  gu_master:   "Gu Master",
  gu_immortal: "Gu Immortal",
  venerable:   "Venerable",
};

function generateLoreCode(tier) {
  const bank = WORDS[tier] || WORDS.gu_master;
  const word = bank[Math.floor(Math.random() * bank.length)];
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${word}-${suffix}`;
}

const AMOUNT_TO_TIER = {
  499:  "gu_master",
  999:  "gu_immortal",
  1500: "venerable",
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function sendCodeEmail(email, code, tier) {
  const tierName = TIER_NAMES[tier] || tier;
  const appUrl = "https://renzu.theomniarch.com.ng";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Omniarch <noreply@theomniarch.com.ng>",
      to: email,
      subject: `Your ${tierName} Realm Access Code`,
      html: `
        <div style="background:#0a0a0a;color:#e8d5a3;font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px;border:1px solid #2a1f0a;">
          <h1 style="color:#c9a84c;font-size:28px;text-align:center;letter-spacing:4px;margin-bottom:8px;">
            THE LEGENDS OF REN ZU
          </h1>
          <p style="text-align:center;color:#8a7040;font-size:12px;letter-spacing:6px;margin-bottom:40px;">
            TREASURE YELLOW HEAVEN
          </p>

          <p style="font-size:16px;line-height:1.8;">Cultivator,</p>
          <p style="font-size:16px;line-height:1.8;">
            Your payment has been received. Heaven acknowledges your dedication.
            You have been granted access to the <strong style="color:#c9a84c;">${tierName} Realm</strong>.
          </p>

          <div style="background:#1a1000;border:1px solid #c9a84c;padding:24px;text-align:center;margin:32px 0;border-radius:4px;">
            <p style="color:#8a7040;font-size:11px;letter-spacing:4px;margin:0 0 12px;">YOUR ACCESS CODE</p>
            <p style="color:#c9a84c;font-size:28px;font-family:monospace;letter-spacing:6px;margin:0;">
              ${code}
            </p>
          </div>

          <p style="font-size:15px;line-height:1.8;color:#a08050;">To ascend:</p>
          <ol style="font-size:15px;line-height:2;color:#a08050;">
            <li>Visit <a href="${appUrl}" style="color:#c9a84c;">${appUrl}</a></li>
            <li>Tap <strong>Treasure Yellow Heaven</strong></li>
            <li>Select your tier and tap <strong>Redeem Code</strong></li>
            <li>Enter the code above</li>
          </ol>

          <p style="font-size:13px;color:#5a4020;margin-top:40px;border-top:1px solid #2a1f0a;padding-top:24px;">
            Guard this code well — it can only be used once. If you encounter any issues,
            reply to this email.
          </p>
        </div>
      `,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);

  const signature = req.headers["verif-hash"];
  if (signature !== process.env.FLW_WEBHOOK_HASH) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody.toString("utf8"));

  if (event.event !== "charge.completed") {
    return res.status(200).json({ received: true });
  }

  const { status, amount, tx_ref, customer } = event.data;

  if (status !== "successful") {
    return res.status(200).json({ received: true });
  }

  const amountInCents = Math.round(amount * 100);
  const tier = AMOUNT_TO_TIER[amountInCents];

  if (!tier) {
    console.error("Unrecognized payment amount:", amount);
    return res.status(200).json({ received: true });
  }

  const code = generateLoreCode(tier);

  const { error } = await supabase.from("payment_codes").insert({
    code,
    tier,
    used: false,
    paystack_reference: tx_ref,
    customer_email: customer?.email || null,
  });

  if (error) {
    console.error("Failed to store payment code:", error);
    return res.status(500).json({ error: "Could not save code" });
  }

  if (customer?.email) {
    try {
      await sendCodeEmail(customer.email, code, tier);
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
    }
  }

  return res.status(200).json({ received: true });
}
