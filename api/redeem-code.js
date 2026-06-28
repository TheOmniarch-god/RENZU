import {
  getSupabaseAdmin,
  getUserFromRequest,
  sendJson
} from "./_supabase.js";

const TIER_GRANTS = {
  gu_master: {
    narrations_remaining: 42,
    chats_remaining: 100
  },
  gu_immortal: {
    narrations_remaining: 500,
    chats_remaining: 999999
  },
  venerable: {
    narrations_remaining: 999999,
    chats_remaining: 999999
  }
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cleanCode(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value, max = 160) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function normalizeTier(tier) {
  if (
    tier === "mortal" ||
    tier === "gu_master" ||
    tier === "gu_immortal" ||
    tier === "venerable"
  ) {
    return tier;
  }

  return "mortal";
}

function tierRank(tier) {
  switch (normalizeTier(tier)) {
    case "venerable":
      return 4;
    case "gu_immortal":
      return 3;
    case "gu_master":
      return 2;
    default:
      return 1;
  }
}

function strongerTier(a, b) {
  return tierRank(a) >= tierRank(b) ? normalizeTier(a) : normalizeTier(b);
}

async function getOrCreateProfile(supabase, authUser) {
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    const { data: created, error: insertErr } = await supabase
      .from("profiles")
      .insert({
        id: authUser.id,
        email: authUser.email || null,
        username: "",
        tier: "mortal",
        daily_chat_used: 0,
        daily_audio_used: 0,
        narrations_remaining: 0,
        chats_remaining: 0,
        last_reset_date: todayKey(),
        collected_gu: []
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    profile = created;
  }

  return profile;
}

async function linkDeviceToUser(supabase, deviceId, userId) {
  if (!deviceId || !userId) return;

  const { error } = await supabase
    .from("device_links")
    .upsert(
      {
        device_id: deviceId,
        user_id: userId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "device_id" }
    );

  if (error) throw error;
}

async function markCodeUsed(supabase, code, deviceId) {
  const { data, error } = await supabase
    .from("payment_codes")
    .update({
      used: true,
      device_id: deviceId || null
    })
    .eq("code", code)
    .eq("used", false)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function grantRealmToProfile(supabase, profile, tier, grant) {
  const finalTier = strongerTier(profile.tier, tier);

  const nextNarrations = Math.max(
    Number(profile.narrations_remaining || 0),
    Number(grant.narrations_remaining || 0)
  );

  const nextChats = Math.max(
    Number(profile.chats_remaining || 0),
    Number(grant.chats_remaining || 0)
  );

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      tier: finalTier,
      narrations_remaining: nextNarrations,
      chats_remaining: nextChats,
      email: profile.email || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", profile.id)
    .select()
    .single();

  if (error) throw error;

  return updated;
}

async function logRedeemTransaction(supabase, { deviceId, authUser, code, tier }) {
  const safeDeviceId = deviceId || authUser.id;

  const payload = {
    device_id: safeDeviceId,
    email: authUser.email || null,
    username: "",
    reference: code,
    amount: 0,
    currency: "NGN",
    plan: tier,
    status: "redeemed_via_code_email_account"
  };

  const { error } = await supabase.from("transactions").insert(payload);

  // Transaction logging should not block realm granting.
  if (error) {
    console.error("Redeem transaction log failed:", error);
  }
}

// POST /api/redeem-code { deviceId, code }
// Paid/redeemed realms are email-bound.
// Guests must login first so their realm follows them across devices.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const body = req.body || {};
  const deviceId = cleanText(body.deviceId, 180);
  const code = cleanCode(body.code);

  if (!code) {
    return sendJson(res, 400, {
      success: false,
      error: "Missing token."
    });
  }

  const supabase = getSupabaseAdmin();

  try {
    const authUser = await getUserFromRequest(req);

    if (!authUser) {
      return sendJson(res, 401, {
        success: false,
        loginRequired: true,
        error: "Bind your soul before redeeming heavenly treasure."
      });
    }

    const { data: codeRow, error: codeErr } = await supabase
      .from("payment_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (codeErr) throw codeErr;

    if (!codeRow) {
      return sendJson(res, 404, {
        success: false,
        error: "Invalid token."
      });
    }

    if (codeRow.used) {
      return sendJson(res, 409, {
        success: false,
        error: "This token has already been redeemed."
      });
    }

    const tier = normalizeTier(codeRow.tier);
    const grant = TIER_GRANTS[tier];

    if (!grant) {
      return sendJson(res, 500, {
        success: false,
        error: "Token has an unrecognized realm."
      });
    }

    const usedCodeRow = await markCodeUsed(supabase, code, deviceId);

    if (!usedCodeRow) {
      return sendJson(res, 409, {
        success: false,
        error: "This token has already been redeemed."
      });
    }

    let profile = await getOrCreateProfile(supabase, authUser);

    profile = await grantRealmToProfile(supabase, profile, tier, grant);

    if (deviceId) {
      await linkDeviceToUser(supabase, deviceId, authUser.id);
    }

    await logRedeemTransaction(supabase, {
      deviceId,
      authUser,
      code,
      tier
    });

    return sendJson(res, 200, {
      success: true,
      accountMode: "email",
      tier: profile.tier,
      redeemedTier: tier,
      narrationsRemaining: profile.narrations_remaining || 0,
      chatsRemaining: profile.chats_remaining || 0,
      userEmail: profile.email || authUser.email || "",
      userName: profile.username || ""
    });
  } catch (err) {
    console.error("api/redeem-code error:", err);

    return sendJson(res, 500, {
      success: false,
      error: "Heaven is unreachable. Try again shortly.",
      details: err.message || String(err)
    });
  }
}
