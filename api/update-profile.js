import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/update-profile  { deviceId, username, email }
// Saves the user's display name/email against their device row.
// This is best-effort from the frontend's perspective (it doesn't
// block on the result), so we keep this endpoint simple.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { deviceId, username, email } = req.body || {};
  if (!deviceId) {
    return res.status(400).json({ error: "Missing deviceId" });
  }

  try {
    const { error } = await supabase
      .from("users")
      .update({ username: username || "", email: email || "" })
      .eq("id", deviceId);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("api/update-profile error:", err);
    return res.status(500).json({ success: false, error: "Internal error" });
  }
}
