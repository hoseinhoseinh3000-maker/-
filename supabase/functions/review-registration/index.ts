import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSecretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return String(parsed.default || "");
  } catch {
    return "";
  }
}

function makeTemporaryPassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  let publishableKey = "";
  try { publishableKey = String(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""); }
  catch { /* use legacy anon key below */ }
  publishableKey = publishableKey || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const secretKey = getSecretKey();
  const authHeader = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !publishableKey || !secretKey) return reply(500, { error: "Function is not configured." });
  if (!authHeader.startsWith("Bearer ")) return reply(401, { error: "ورود مدیر لازم است." });

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "نشست کاربری معتبر نیست." });

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "admin" || profile.is_active !== true) {
    return reply(403, { error: "فقط مدیر سامانه می‌تواند درخواست‌ها را بررسی کند." });
  }

  let body: { request_id?: string; decision?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "درخواست قابل خواندن نیست." }); }
  const requestId = String(body.request_id || "");
  const decision = String(body.decision || "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["approve", "reject"].includes(decision)) {
    return reply(400, { error: "شناسه درخواست یا تصمیم معتبر نیست." });
  }

  const { data: row, error: fetchError } = await admin
    .from("registration_requests")
    .select("id,full_name,email,phone,status")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError || !row) return reply(404, { error: "درخواست پیدا نشد." });
  if (row.status !== "pending") return reply(409, { error: "این درخواست قبلاً بررسی شده است." });

  if (decision === "reject") {
    const { data: rejected, error } = await admin
      .from("registration_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: authData.user.id })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error || !rejected) return reply(409, { error: "وضعیت درخواست تغییر کرده؛ صفحه را تازه‌سازی کن." });
    return reply(200, { ok: true, decision: "rejected", message: "درخواست رد شد." });
  }

  // Claim this pending request atomically so two admins cannot approve it at once.
  const { data: claimed, error: claimError } = await admin
    .from("registration_requests")
    .update({ status: "processing", reviewed_by: authData.user.id })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) return reply(409, { error: "درخواست در حال بررسی یا قبلاً بررسی شده است." });

  const temporaryPassword = makeTemporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: row.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: row.full_name },
  });

  if (createError || !created.user) {
    await admin.from("registration_requests").update({
      status: "pending",
      reviewed_by: null,
    }).eq("id", requestId).eq("status", "processing");
    return reply(400, { error: createError?.message || "ساخت حساب انجام نشد؛ درخواست دوباره در صف قرار گرفت." });
  }

  const { error: updateError } = await admin
    .from("registration_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: authData.user.id,
      created_user_id: created.user.id,
    })
    .eq("id", requestId);

  if (updateError) {
    // Account creation succeeded. Return the credentials and make the inconsistency explicit.
    return reply(200, {
      ok: true,
      decision: "approved",
      warning: "حساب ساخته شد، اما ثبت وضعیت درخواست کامل نشد. مدیر باید صف درخواست‌ها را بررسی کند.",
      email: row.email,
      full_name: row.full_name,
      temporary_password: temporaryPassword,
    });
  }

  return reply(200, {
    ok: true,
    decision: "approved",
    email: row.email,
    full_name: row.full_name,
    temporary_password: temporaryPassword,
    message: "حساب عضو ایجاد شد. رمز موقت فقط همین بار به مدیر نمایش داده می‌شود.",
  });
});
