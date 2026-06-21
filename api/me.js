import {
  getSupabaseAdmin,
  getUserFromRequest,
  sendJson
} from "./_supabase.js";

const DAILY_CHAT_LIMIT = 3;
const DAILY_AUDIO_LIMIT = 2;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function tierRank(tier) {
  switch (tier) {
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

function toFrontendProfile(row) {
  return {
    tier: normalizeTier(row.tier),
    dailyChatUsed: row.daily_chat_used || 0,
    dailyAudioUsed: row.daily_audio_used || 0,
    narrationsRemaining: row.narrations_remaining || 0,
    chatsRemaining: row.chats_remaining || 0,
    userEmail: row.email || "",
    userName: row.username || "",
    collectedGu: Array.isArray(row.collected_gu) ? row.collected_gu : undefined,
    accountMode: "email"
  };
}

function toFrontendGuest(row) {
  return {
    tier: normalizeTier(row.tier),
    dailyChatUsed: row.daily_chat_used || 0,
    dailyAudioUsed: row.daily_audio_used || 0,
    narrationsRemaining: row.narrations_remaining || 0,
    chatsRemaining: row.chats_remaining || 0,
    userEmail: row.email || "",
    userName: row.username || "",
    accountMode: "device"
  };
}

async function getOrCreateGuestUser(supabase, deviceId) {
  let { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;

  if (!user) {
    const { data: created, error: insertErr } = await supabase
      .from("users")
      .insert({
        id: deviceId,
        tier: "mortal",
        daily_chat_used: 0,
        daily_audio_used: 0,
        narrations_remaining: 0,
        chats_remaining: 0,
        last_reset_date: todayKey()
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    user = created;
  }

  return user;
}

async function resetGuestDailyIfNeeded(supabase, user, deviceId) {
  const today = todayKey();

  if (user.last_reset_date === today) {
    return user;
  }

  const { data: reset, error: resetErr } = await supabase
    .from("users")
    .update({
      daily_chat_used: 0,
      daily_audio_used: 0,
      last_reset_date: today
    })
    .eq("id", deviceId)
    .select()
    .single();

  if (resetErr) throw resetErr;

  return reset;
}

async function getOrCreateProfile(supabase, user) {
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile) {
    const { data: created, error: insertErr } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email || null,
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

async function resetProfileDailyIfNeeded(supabase, profile) {
  const today = todayKey();

  if (profile.last_reset_date === today) {
    return profile;
  }

  const { data: reset, error: resetErr } = await supabase
    .from("profiles")
    .update({
      daily_chat_used: 0,
      daily_audio_used: 0,
      last_reset_date: today
    })
    .eq("id", profile.id)
    .select()
    .single();

  if (resetErr) throw resetErr;

  return reset;
}

/**
 * If someone had old guest/device credits before login,
 * this gently moves the better realm/credits into the email profile.
 *
 * Email remains the true identity.
 * Device only helps recover old guest state once.
 */
async function maybeMergeGuestIntoProfile(supabase, profile, deviceId) {
  if (!deviceId) return profile;

  const { data: guest, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;
  if (!guest) return profile;

  const guestTier = normalizeTier(guest.tier);
  const profileTier = normalizeTier(profile.tier);

  const merged = {
    email: profile.email,
    username: profile.username,
    tier: profileTier,
    narrations_remaining: profile.narrations_remaining || 0,
    chats_remaining: profile.chats_remaining || 0,
    daily_audio_used: profile.daily_audio_used || 0,
    daily_chat_used: profile.daily_chat_used || 0,
    last_reset_date: profile.last_reset_date || todayKey()
  };

  let changed = false;

  if (tierRank(guestTier) > tierRank(profileTier)) {
    merged.tier = guestTier;
    changed = true;
  }

  const guestNarrations = guest.narrations_remaining || 0;
  const guestChats = guest.chats_remaining || 0;

  if (guestNarrations > merged.narrations_remaining) {
    merged.narrations_remaining = guestNarrations;
    changed = true;
  }

  if (guestChats > merged.chats_remaining) {
    merged.chats_remaining = guestChats;
    changed = true;
  }

  if (!profile.email && guest.email) {
    merged.email = guest.email;
    changed = true;
  }

  if (!profile.username && guest.username) {
    merged.username = guest.username;
    changed = true;
  }

  if (!changed) {
    return profile;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("profiles")
    .update(merged)
    .eq("id", profile.id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  return updated;
}

// GET /api/me?deviceId=...
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const supabase = getSupabaseAdmin();
  const deviceId = String(req.query.deviceId || "").trim();

  try {
    const authUser = await getUserFromRequest(req);

    // Logged-in mode: email/Supabase account is the true identity.
    if (authUser) {
      let profile = await getOrCreateProfile(supabase, authUser);

      profile = await maybeMergeGuestIntoProfile(supabase, profile, deviceId);
      profile = await resetProfileDailyIfNeeded(supabase, profile);

      return sendJson(res, 200, toFrontendProfile(profile));
    }

    // Guest mode: fallback to device row.
    if (!deviceId) {
      return sendJson(res, 400, { error: "Missing deviceId" });
    }

    let guest = await getOrCreateGuestUser(supabase, deviceId);
    guest = await resetGuestDailyIfNeeded(supabase, guest, deviceId);

    return sendJson(res, 200, toFrontendGuest(guest));
  } catch (err) {
    console.error("api/me error:", err);
    return sendJson(res, 500, {
      error: "Internal error",
      details: err.message || String(err)
    });
  }
}
