import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Granted allowances per tier on successful redemption — keep these
// numbers identical to the frontend's GU_MASTER_NARRATIONS etc.
const TIER_GRANTS = {
  gu_master:   { narrations_remaining: 42,     chats_remaining: 100 },
  gu_immortal: { narrations_remaining: 500,    chats_remaining: 999999 },
  venerable:   { narrations_remaining: 999999, chats_remaining: 999999 },
};

// POST /api/redeem-code  { deviceId, code }
// Looks up a one-time payment code, marks it used, and upgrades the
// device's tier + allowance. Codes are case-insensitive — the frontend
// already lowercases/trims before sending.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { deviceId, code } = req.body || {};
  if (!deviceId || !code) {
    return res.status(400).json({ success: false, error: "Missing deviceId/code" });
  }

  try {
    const { data: codeRow, error: codeErr } = await supabase
      .from("payment_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (codeErr) throw codeErr;

    if (!codeRow) {
      return res.status(404).json({ success: false, error: "Invalid token." });
    }
    if (codeRow.used) {
      return res.status(409).json({ success: false, error: "This token has already been redeemed." });
    }

    const grant = TIER_GRANTS[codeRow.tier];
    if (!grant) {
      return res.status(500).json({ success: false, error: "Token has an unrecognized tier." });
    }

    // Mark the code as used first — if this fails we bail before granting anything.
    const { error: markErr } = await supabase
      .from("payment_codes")
      .update({ used: true, device_id: deviceId })
      .eq("code", code)
      .eq("used", false); // guards against a double-redeem race
    if (markErr) throw markErr;

    // Ensure the user row exists, then upgrade it.
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", deviceId)
      .maybeSingle();

    if (!existingUser) {
      const { error: insertErr } = await supabase.from("users").insert({
        id: deviceId,
        tier: codeRow.tier,
        ...grant,
        last_reset_date: new Date().toISOString().slice(0, 10),
      });
      if (insertErr) throw insertErr;
    } else {
      const { error: updateErr } = await supabase
        .from("users")
        .update({ tier: codeRow.tier, ...grant })
        .eq("id", deviceId);
      if (updateErr) throw updateErr;
    }

    // Log the transaction for your own records.
    await supabase.from("transactions").insert({
      device_id: deviceId,
      reference: code,
      amount: 0,
      currency: "NGN",
      plan: codeRow.tier,
      status: "redeemed_via_code",
    });

    return res.status(200).json({ success: true, tier: codeRow.tier });
  } catch (err) {
    console.error("api/redeem-code error:", err);
    return res.status(500).json({ success: false, error: "Heaven is unreachable. Try again shortly." });
  }
}
