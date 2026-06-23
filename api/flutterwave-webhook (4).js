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
  gu_master: "Gu Master",
  gu_immortal: "Gu Immortal",
  venerable: "Venerable",
};

// IMPORTANT:
// Keep this matched to your actual live prices.
// Current frontend prices are 4.99 / 9.99 / 29.99
const AMOUNT_TO_TIER = {
  499: "gu_master",
  999: "gu_immortal",
  2999: "venerable",
};

function generateLoreCode(tier) {
  const bank = WORDS[tier] || WORDS.gu_master;
  const word = bank[Math.floor(Math.random() * bank.length)];
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${word}-${suffix}`;
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function verifyFlutterwaveTransaction(id) {
  const res = await fetch(`https://api.flutterwave.com/v3/transactions/${id}/verify`, {
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    },
  });

  const data = await res.json();

  if (!res.ok || data?.status !== "success" || !data?.data) {
    throw new Error(data?.message || `Flutterwave verify failed (${res.status})`);
  }

  return data.data;
}

async function sendCodeEmail(email, code, tier) {
  if (!email) return;

  const tierName = TIER_NAMES[tier] || tier;
  const appUrl = process.env.PUBLIC_SITE_URL || "https://renzu.theomniarch.com.ng";

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Omniarch <noreply@theomniarch.com.ng>",
      to: email,
      subject: `Your ${tierName} Realm Access Code`,
      html: `
        <div style="background:#0a0a0a;color:#e8d5a3;font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px;border:1px solid #2a1f0a;">
          <h1 style="color:#c9a84c;font-size:28px;text-align:center;letter-spacing:4px;margin-bottom:8px;">THE LEGENDS OF REN ZU</h1>
          <p style="text-align:center;color:#8a7040;font-size:12px;letter-spacing:6px;margin-bottom:40px;">TREASURE YELLOW HEAVEN</p>
          <p style="font-size:16px;line-height:1.8;">Cultivator,</p>
          <p style="font-size:16px;line-height:1.8;">Your payment has been verified. Heaven acknowledges your dedication. You have been granted access to the <strong style="color:#c9a84c;">${tierName} Realm</strong>.</p>
          <div style="background:#1a1000;border:1px solid #c9a84c;padding:24px;text-align:center;margin:32px 0;border-radius:4px;">
            <p style="color:#8a7040;font-size:11px;letter-spacing:4px;margin:0 0 12px;">YOUR ACCESS CODE</p>
            <p style="color:#c9a84c;font-size:28px;font-family:monospace;letter-spacing:6px;margin:0;">${code}</p>
          </div>
          <ol style="font-size:15px;line-height:2;color:#a08050;">
            <li>Visit <a href="${appUrl}" style="color:#c9a84c;">${appUrl}</a></li>
            <li>Tap <strong>Treasure Yellow Heaven</strong></li>
            <li>Paste your code</li>
            <li>Ascend</li>
          </ol>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const text = await emailRes.text().catch(() => "");
    throw new Error(`Resend failed: ${emailRes.status} ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["verif-hash"];

    if (!process.env.FLW_WEBHOOK_HASH || signature !== process.env.FLW_WEBHOOK_HASH) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString("utf8"));

    if (event?.event !== "charge.completed") {
      return res.status(200).json({ received: true, ignored: true });
    }

    const webhookData = event?.data || {};
    const transactionId = webhookData.id;
    const txRef = webhookData.tx_ref;

    if (!transactionId || !txRef) {
      return res.status(200).json({ received: true, ignored: true, reason: "missing id/tx_ref" });
    }

    // Idempotency guard: if we already created a code for this payment reference, stop here.
    const { data: existingCode, error: existingErr } = await supabase
      .from("payment_codes")
      .select("id, code, tier")
      .eq("paystack_reference", txRef)
      .maybeSingle();

    if (existingErr) {
      console.error("Existing code lookup failed:", existingErr);
      return res.status(500).json({ error: "Could not check existing payment" });
    }

    if (existingCode) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Verify directly with Flutterwave. Never trust the webhook body alone for live fulfilment.
    const verified = await verifyFlutterwaveTransaction(transactionId);

    if (verified.status !== "successful") {
      return res.status(200).json({ received: true, ignored: true, reason: "not successful after verify" });
    }

    const amountMinor = Math.round(Number(verified.amount || 0) * 100);
    const tier = AMOUNT_TO_TIER[amountMinor];

    if (!tier) {
      console.error("Unrecognized verified payment amount:", verified.amount, verified.currency, verified.tx_ref);
      return res.status(200).json({ received: true, ignored: true, reason: "unrecognized amount" });
    }

    if (process.env.FLW_EXPECTED_CURRENCY) {
      const expectedCurrency = process.env.FLW_EXPECTED_CURRENCY.trim().toUpperCase();
      const actualCurrency = String(verified.currency || "").trim().toUpperCase();
      if (expectedCurrency && actualCurrency !== expectedCurrency) {
        console.error("Currency mismatch:", { expectedCurrency, actualCurrency, txRef });
        return res.status(200).json({ received: true, ignored: true, reason: "currency mismatch" });
      }
    }

    const email = verified?.customer?.email || webhookData?.customer?.email || null;
    const code = generateLoreCode(tier);

    const { error: codeInsertErr } = await supabase
      .from("payment_codes")
      .insert({
        code,
        tier,
        used: false,
        paystack_reference: txRef,
        customer_email: email,
        email,
      });

    if (codeInsertErr) {
      console.error("Failed to store payment code:", codeInsertErr);
      return res.status(500).json({ error: "Could not save payment code" });
    }

    // Best-effort bookkeeping
    const { error: txInsertErr } = await supabase.from("transactions").insert({
      reference: txRef,
      amount: amountMinor,
      currency: verified.currency || "",
      plan: tier,
      status: "successful",
      email,
    });

    if (txInsertErr) {
      console.error("Transaction log insert failed:", txInsertErr);
    }

    if (email && process.env.RESEND_API_KEY) {
      try {
        await sendCodeEmail(email, code, tier);
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("flutterwave-webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
