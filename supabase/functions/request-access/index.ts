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
  try {
    const parsed = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const current = String(parsed.default || "");
    if (current) return current;
  } catch { /* use legacy key if present */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
}

async function hashRequestIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) return reply(500, { error: "Function is not configured." });

  let body: { full_name?: string; email?: string; phone?: string; reason?: string; website?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "درخواست قابل خواندن نیست." }); }

  // Honeypot: bots fill this hidden field; return a neutral response without storing it.
  if (String(body.website || "").trim()) {
    return reply(200, { ok: true, message: "درخواست شما دریافت شد." });
  }

  const fullName = String(body.full_name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim().slice(0, 32);
  const reason = String(body.reason || "").trim().slice(0, 1200);

  if (fullName.length < 2) return reply(400, { error: "نام و نام خانوادگی را کامل وارد کنید." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return reply(400, { error: "ایمیل معتبر وارد کنید." });
  }
  if (reason.length < 8) return reply(400, { error: "لطفاً کوتاه توضیح دهید چرا به حساب نیاز دارید." });

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const forwarded = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0].trim().slice(0, 100);
  const ipHash = await hashRequestIp(ip, secretKey);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: ipCount, error: rateError } = await admin
    .from("registration_requests")
    .select("id", { count: "exact", head: true })
    .eq("request_ip_hash", ipHash)
    .gte("created_at", since);

  if (rateError) return reply(500, { error: "بررسی محدودیت درخواست ناموفق بود. مدیر سامانه باید نصب پایگاه داده را بررسی کند." });
  if ((ipCount || 0) >= 4) return reply(429, { error: "تعداد درخواست‌ها از این اتصال زیاد است. یک ساعت دیگر دوباره تلاش کنید." });

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) return reply(409, { error: "برای این ایمیل حسابی وجود دارد. برای بازیابی دسترسی با مدیر مجموعه تماس بگیرید." });

  const { data: duplicate } = await admin
    .from("registration_requests")
    .select("id")
    .eq("email", email)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (duplicate) return reply(409, { error: "برای این ایمیل قبلاً درخواست در انتظار بررسی ثبت شده است." });

  const { error: insertError } = await admin.from("registration_requests").insert({
    full_name: fullName,
    email,
    phone: phone || null,
    reason,
    status: "pending",
    request_ip_hash: ipHash,
  });

  if (insertError) {
    // The partial unique index is the final guard against duplicate pending requests.
    if (insertError.code === "23505") return reply(409, { error: "برای این ایمیل قبلاً درخواست ثبت شده است." });
    return reply(500, { error: "ثبت درخواست انجام نشد. لطفاً بعداً دوباره تلاش کنید." });
  }

  return reply(200, { ok: true, message: "درخواستت با موفقیت برای مدیر مجموعه ارسال شد." });
});
