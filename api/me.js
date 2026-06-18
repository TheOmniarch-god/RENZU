import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// GET /api/me?deviceId=...
// Returns the user's current tier + usage so the frontend can sync
// state across devices/browsers instead of relying only on localStorage.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { deviceId } = req.query;
  if (!deviceId) {
    return res.status(400).json({ error: "Missing deviceId" });
  }

  try {
    let { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", deviceId)
      .maybeSingle();

    if (error) throw error;

    // First time we've seen this device — create a fresh mortal-tier row.
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
          last_reset_date: todayKey(),
        })
        .select()
        .single();
      if (insertErr) throw insertErr;
      user = created;
    }

    // Daily counters reset once a new calendar day has passed.
    // This mirrors the frontend's DAILY_CHAT_LIMIT / DAILY_AUDIO_LIMIT
    // logic for mortal tier — paid tiers manage their own remaining
    // counts, granted at purchase/redemption time, so we don't touch
    // narrations_remaining/chats_remaining here.
    const today = todayKey();
    if (user.last_reset_date !== today) {
      const { data: reset, error: resetErr } = await supabase
        .from("users")
        .update({
          daily_chat_used: 0,
          daily_audio_used: 0,
          last_reset_date: today,
        })
        .eq("id", deviceId)
        .select()
        .single();
      if (resetErr) throw resetErr;
      user = reset;
    }

    return res.status(200).json({
      tier: user.tier,
      dailyChatUsed: user.daily_chat_used,
      dailyAudioUsed: user.daily_audio_used,
      narrationsRemaining: user.narrations_remaining,
      chatsRemaining: user.chats_remaining,
      userEmail: user.email || "",
      userName: user.username || "",
    });
  } catch (err) {
    console.error("api/me error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
