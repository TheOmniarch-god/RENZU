import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Same limits as the frontend's local-fallback constants — kept in sync
// manually since this is plain JS, not a shared module.
const DAILY_CHAT_LIMIT = 3;
const DAILY_AUDIO_LIMIT = 2;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// POST /api/use-credit  { deviceId, type: "chat" | "audio" }
// Atomically spends one unit of essence for this device, based on tier:
//   venerable    -> always allowed, nothing decremented
//   gu_immortal  -> audio decrements narrations_remaining, chat is free
//   gu_master    -> audio decrements narrations_remaining, chat decrements chats_remaining
//   mortal       -> audio/chat decrement the daily_* counters against fixed daily limits
// Returns 402 (Payment Required) when the relevant allowance is exhausted,
// which the frontend uses to trigger the Treasure Yellow Heaven paywall.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { deviceId, type } = req.body || {};
  if (!deviceId || (type !== "chat" && type !== "audio")) {
    return res.status(400).json({ error: "Missing or invalid deviceId/type" });
  }

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", deviceId)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Reset daily counters first if a new day has started.
    const today = todayKey();
    let dailyChatUsed = user.daily_chat_used;
    let dailyAudioUsed = user.daily_audio_used;
    if (user.last_reset_date !== today) {
      dailyChatUsed = 0;
      dailyAudioUsed = 0;
    }

    // ── Venerable: unlimited, nothing to track ──
    if (user.tier === "venerable") {
      return res.status(200).json({ success: true });
    }

    // ── Gu Immortal: unlimited chat, metered narrations ──
    if (user.tier === "gu_immortal") {
      if (type === "chat") {
        return res.status(200).json({ success: true });
      }
      if (user.narrations_remaining > 0) {
        const { data: updated, error: updateErr } = await supabase
          .from("users")
          .update({ narrations_remaining: user.narrations_remaining - 1 })
          .eq("id", deviceId)
          .select()
          .single();
        if (updateErr) throw updateErr;
        return res.status(200).json({
          success: true,
          narrationsRemaining: updated.narrations_remaining,
        });
      }
      return res.status(402).json({ error: "Narrations exhausted" });
    }

    // ── Gu Master: metered narrations and chats ──
    if (user.tier === "gu_master") {
      if (type === "audio") {
        if (user.narrations_remaining > 0) {
          const { data: updated, error: updateErr } = await supabase
            .from("users")
            .update({ narrations_remaining: user.narrations_remaining - 1 })
            .eq("id", deviceId)
            .select()
            .single();
          if (updateErr) throw updateErr;
          return res.status(200).json({
            success: true,
            narrationsRemaining: updated.narrations_remaining,
          });
        }
        return res.status(402).json({ error: "Narrations exhausted" });
      } else {
        if (user.chats_remaining > 0) {
          const { data: updated, error: updateErr } = await supabase
            .from("users")
            .update({ chats_remaining: user.chats_remaining - 1 })
            .eq("id", deviceId)
            .select()
            .single();
          if (updateErr) throw updateErr;
          return res.status(200).json({
            success: true,
            chatsRemaining: updated.chats_remaining,
          });
        }
        return res.status(402).json({ error: "Chats exhausted" });
      }
    }

    // ── Mortal: fixed small daily allowance ──
    if (type === "audio") {
      if (dailyAudioUsed < DAILY_AUDIO_LIMIT) {
        const { data: updated, error: updateErr } = await supabase
          .from("users")
          .update({
            daily_audio_used: dailyAudioUsed + 1,
            daily_chat_used: dailyChatUsed,
            last_reset_date: today,
          })
          .eq("id", deviceId)
          .select()
          .single();
        if (updateErr) throw updateErr;
        return res.status(200).json({
          success: true,
          dailyAudioUsed: updated.daily_audio_used,
          dailyChatUsed: updated.daily_chat_used,
        });
      }
      return res.status(402).json({ error: "Daily audio limit reached" });
    } else {
      if (dailyChatUsed < DAILY_CHAT_LIMIT) {
        const { data: updated, error: updateErr } = await supabase
          .from("users")
          .update({
            daily_chat_used: dailyChatUsed + 1,
            daily_audio_used: dailyAudioUsed,
            last_reset_date: today,
          })
          .eq("id", deviceId)
          .select()
          .single();
        if (updateErr) throw updateErr;
        return res.status(200).json({
          success: true,
          dailyChatUsed: updated.daily_chat_used,
          dailyAudioUsed: updated.daily_audio_used,
        });
      }
      return res.status(402).json({ error: "Daily chat limit reached" });
    }
  } catch (err) {
    console.error("api/use-credit error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
