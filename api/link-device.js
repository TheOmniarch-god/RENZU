import {
  getSupabaseAdmin,
  getUserFromRequest,
  sendJson
} from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);

  if (!user) {
    return sendJson(res, 401, { error: "Not authenticated" });
  }

  let body = {};

  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch (_) {
    body = {};
  }

  const deviceId = String(body.deviceId || "").trim();
  const username = String(body.username || "").trim();

  if (!deviceId) {
    return sendJson(res, 400, { error: "Missing deviceId" });
  }

  const supabase = getSupabaseAdmin();

  const profilePayload = {
    id: user.id,
    email: user.email || null,
    updated_at: new Date().toISOString()
  };

  if (username) {
    profilePayload.username = username;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (profileError) {
    return sendJson(res, 500, {
      error: "Failed to create profile",
      details: profileError.message
    });
  }

  const { error: linkError } = await supabase
    .from("device_links")
    .upsert(
      {
        device_id: deviceId,
        user_id: user.id,
        updated_at: new Date().toISOString()
      },
      { onConflict: "device_id" }
    );

  if (linkError) {
    return sendJson(res, 500, {
      error: "Failed to link device",
      details: linkError.message
    });
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (readError) {
    return sendJson(res, 500, {
      error: "Failed to read profile",
      details: readError.message
    });
  }

  return sendJson(res, 200, {
    success: true,
    user: {
      id: user.id,
      email: user.email
    },
    profile
  });
}
