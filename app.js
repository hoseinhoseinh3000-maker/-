(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const app = $("#app");
  const cfg = window.SARBAZAN_CONFIG || {};
  let client = null, authUser = null, profile = null, selectedMember = null;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const shortName = (s) => (String(s || "?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("") || "?");
  const dateText = (s) => { if(!s)return "بدون تاریخ"; try{return new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium"}).format(new Date(s));}catch(_){return s;} };
  function notice(message, type="info") { const box=$("#flash"); if(box){box.className="alert "+type;box.textContent=message;box.hidden=false;} else alert(message); }
  function configProblem() {
    app.innerHTML = '<div class="auth-wrap"><main class="auth-card"><div class="logo">✦</div><p class="eyebrow">تنظیم اولیه</p><h1>اتصال پایگاه داده هنوز انجام نشده</h1><p class="muted">فایل config.js را باز کن و آدرس پروژه Supabase و کلید عمومی anon/publishable را در آن قرار بده. کلید Secret یا Service Role را هرگز اینجا نگذار.</p><div class="alert info">بعد از تنظیم فایل و ذخیره آن در GitHub، صفحه را دوباره باز کن.</div><p class="auth-foot">این صفحه تا زمان اتصال به پایگاه داده، ورود کاربران را فعال نمی‌کند.</p></main></div>';
  }
  function loginView() {
    app.innerHTML = '<div class="auth-wrap"><main class="auth-card"><div class="logo">✦</div><p class="eyebrow">سامانه یکپارچه فرهنگی</p><h1>سربازان امام زمان</h1><p class="muted">برای ورود به پنل اختصاصی، ایمیل و رمز عبوری را که مدیر در اختیارت گذاشته وارد کن.</p><div id="flash" hidden></div><form id="loginForm"><div class="field"><label>ایمیل / نام کاربری ایمیلی</label><input name="email" type="email" autocomplete="username" required dir="ltr"></div><div class="field"><label>رمز عبور</label><input name="password" type="password" autocomplete="current-password" required dir="ltr"></div><button class="btn primary wide">ورود به پنل من</button></form><div class="auth-foot">ثبت‌نام عمومی غیرفعال است • دسترسی هر عضو جداگانه محافظت می‌شود</div></main></div>';
    $("#loginForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const form = new FormData(ev.currentTarget);
      const button = $("button", ev.currentTarget); button.disabled=true; button.textContent="در حال ورود...";
      const {error} = await client.auth.signInWithPassword({email:String(form.get("email")).trim(),password:String(form.get("password"))});
      button.disabled=false;button.textContent="ورود به پنل من";
      if(error) notice("ورود انجام نشد. ایمیل و رمز عبور را بررسی کن.","error");
      else await loadProfile();
    });
  }
  function shell(title, subtitle, body, admin) {
    app.innerHTML = '<div class="shell"><aside class="side"><div class="brand"><div class="logo">✦</div><div><b>سربازان امام زمان</b><small>سامانه مدیریت فرهنگی</small></div></div><div class="navlabel">فضای کاری</div><nav class="nav">'+
      (admin?'<button data-go="home" class="active">▦ نمای کلی</button><button data-go="members">♙ مدیریت اعضا</button><button data-go="announcements">✧ اطلاعیه عمومی</button>':'<button data-go="home" class="active">▦ پنل اختصاصی من</button>')+
      '<button data-go="password">⚿ تغییر رمز عبور</button></nav><div class="sidefoot">● اتصال مرکزی فعال<br>دسترسی‌ها توسط پایگاه داده کنترل می‌شوند.</div></aside><main class="main"><header class="top"><div><p class="eyebrow">مرکز مدیریت فرهنگی</p><h1>'+esc(title)+'</h1><div class="panelhint">'+esc(subtitle)+'</div></div><div class="userchip"><span class="avatar">'+esc(shortName(profile.full_name))+'</span><span>'+esc(profile.full_name)+'<br><small class="muted">'+(admin?'مدیر سامانه':'عضو مجموعه')+'</small></span><button class="btn small" id="logoutBtn">خروج</button></div></header><div id="flash" hidden></div><section id="page">'+body+'</section><div class="footer">پنل اختصاصی • اطلاعات به‌صورت مرکزی و آنلاین ذخیره می‌شود</div></main></div>';
    $("#logoutBtn").addEventListener("click", async()=>{await client.auth.signOut();authUser=null;profile=null;loginView();});
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
  }
  async function loadProfile() {
    const {data:{user},error:authError} = await client.auth.getUser();
    if(authError || !user){loginView();return;}
    authUser=user;
    const {data,error} = await client.from("profiles").select("id,email,full_name,role,is_active").eq("id",user.id).maybeSingle();
    if(error || !data){await client.auth.signOut();loginView();notice("پروفایل حساب پیدا نشد؛ مدیر باید حساب را در پایگاه داده بررسی کند.","error");return;}
    if(!data.is_active){await client.auth.signOut();loginView();notice("این حساب توسط مدیر غیرفعال شده است.","error");return;}
    profile=data;
    if(profile.role==="admin") await adminHome(); else await memberHome();
  }
  async function adminHome() {
    const [{count:members},{count:entries},{count:notices}] = await Promise.all([
      client.from("profiles").select("*",{count:"exact",head:true}).eq("role","member"),
      client.from("member_entries").select("*",{count:"exact",head:true}),
      client.from("announcements").select("*",{count:"exact",head:true})
    ]);
    const body='<div class="hero"><h2>پنل مدیریت مرکزی</h2><p>برای هر عضو حساب بساز، اطلاعات اختصاصی ارسال کن و اطلاعیه‌های عمومی را مدیریت کن. هر عضو تنها اطلاعات حساب خودش را می‌بیند.</p><div class="hero-actions"><button class="btn primary" data-go="members">مدیریت حساب اعضا</button><button class="btn" data-go="announcements">انتشار اطلاعیه</button></div></div><div class="grid"><div class="stat"><small>تعداد اعضا</small><strong>'+(members??0)+'</strong></div><div class="stat"><small>اطلاعات ثبت‌شده</small><strong>'+(entries??0)+'</strong></div><div class="stat"><small>اطلاعیه‌ها</small><strong>'+(notices??0)+'</strong></div><div class="stat"><small>نقش حساب</small><strong style="font-size:18px">مدیر</strong></div></div><div class="panel"><div class="panelhead"><h2>شروع سریع</h2></div><p class="muted">۱) از مدیریت اعضا حساب جدید بساز. ۲) عضو را انتخاب کن و اطلاعات اختصاصی‌اش را ذخیره کن. ۳) نام کاربری ایمیلی و رمز اولیه را امن به خودش تحویل بده.</p></div>';
    shell("نمای کلی سامانه","گزارش حساب‌ها و داده‌های مرکزی",body,true);
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
  }
  async function adminMembers() {
    const {data,error}=await client.from("profiles").select("id,email,full_name,role,is_active,created_at").eq("role","member").order("created_at",{ascending:false});
    if(error){notice(error.message,"error");return;}
    const rows=(data||[]).map(m=>'<tr><td>'+esc(m.full_name)+'</td><td dir="ltr">'+esc(m.email)+'</td><td><span class="badge '+(m.is_active?'':'off')+'">'+(m.is_active?'فعال':'غیرفعال')+'</span></td><td><div class="actions"><button class="btn small primary" data-member="'+esc(m.id)+'">پنل اختصاصی</button><button class="btn small" data-toggle="'+esc(m.id)+'" data-active="'+(m.is_active?'1':'0')+'">'+(m.is_active?'غیرفعال‌کردن':'فعال‌کردن')+'</button></div></td></tr>').join("");
    const body='<div class="section"><div><h2>مدیریت اعضا</h2><p>ایجاد حساب مستقل و مدیریت محتوای اختصاصی هر فرد</p></div></div>'+
      '<div class="panel"><div class="panelhead"><h2>＋ ساخت حساب عضو جدید</h2><span class="badge">دسترسی اختصاصی</span></div><form id="createMember"><div class="formgrid"><div class="field"><label>نام و نام خانوادگی</label><input name="full_name" required maxlength="120"></div><div class="field"><label>ایمیل عضو (نام کاربری ورود)</label><input name="email" type="email" required dir="ltr"></div><div class="field full"><label>رمز اولیه (حداقل ۱۰ نویسه)</label><input name="password" type="password" required minlength="10" dir="ltr"></div></div><div class="actions"><button class="btn primary">ساخت حساب</button></div></form><div class="panelhint">برای ساخت حساب جدید، Edge Function امن باید یک‌بار روی Supabase منتشر شده باشد.</div><div id="credentialResult"></div></div>'+
      '<div class="panel"><div class="panelhead"><h2>فهرست اعضا</h2><span class="badge">'+(data||[]).length+' حساب</span></div>'+(rows?'<div class="tablewrap"><table><thead><tr><th>نام</th><th>ایمیل ورود</th><th>وضعیت</th><th>مدیریت</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">هنوز حساب عضوی ایجاد نشده است.</div>')+'</div>';
    shell("مدیریت اعضا","حساب‌های اختصاصی مجموعه",body,true);
    $("#createMember").addEventListener("submit",createMember);
    document.querySelectorAll("[data-member]").forEach(b=>b.addEventListener("click",()=>openMember(b.dataset.member)));
    document.querySelectorAll("[data-toggle]").forEach(b=>b.addEventListener("click",()=>toggleMember(b.dataset.toggle,b.dataset.active==="1")));
  }
  async function createMember(ev) {
    ev.preventDefault();
    const f=new FormData(ev.currentTarget), btn=$("button",ev.currentTarget);
    btn.disabled=true;btn.textContent="در حال ساخت...";
    const {data,error}=await client.functions.invoke("create-member",{body:{email:String(f.get("email")).trim(),full_name:String(f.get("full_name")).trim(),password:String(f.get("password"))}});
    btn.disabled=false;btn.textContent="ساخت حساب";
    const out=$("#credentialResult");
    if(error){out.innerHTML='<div class="alert error">ساخت حساب انجام نشد. مطمئن شو تابع create-member در Supabase منتشر شده است. '+esc(error.message)+'</div>';return;}
    out.innerHTML='<div class="alert success">حساب با موفقیت ساخته شد. ایمیل و رمز را به‌صورت امن به عضو تحویل بده.</div><div class="credentials">نام: '+esc(data.full_name)+'<br>ایمیل ورود: <code>'+esc(data.email)+'</code><br>رمز اولیه: <code>'+esc(f.get("password"))+'</code></div>';
    ev.currentTarget.reset();
    await adminMembers();
  }
  async function toggleMember(id,wasActive) {
    const {error}=await client.from("profiles").update({is_active:!wasActive}).eq("id",id);
    if(error){notice("تغییر وضعیت انجام نشد: "+error.message,"error");return;}
    await adminMembers();
  }
  async function openMember(id) {
    selectedMember=id;
    const {data:member,error:merr}=await client.from("profiles").select("id,email,full_name,is_active").eq("id",id).single();
    if(merr||!member){notice("عضو پیدا نشد.","error");return;}
    const {data:entries,error}=await client.from("member_entries").select("id,title,body,created_at").eq("member_id",id).order("created_at",{ascending:false});
    if(error){notice(error.message,"error");return;}
    const entryHTML=(entries||[]).map(x=>'<article class="entry"><h3>'+esc(x.title)+'</h3><p>'+esc(x.body)+'</p><small>'+esc(new Date(x.created_at).toLocaleString("fa-IR"))+'</small><button class="btn small danger" data-delete-entry="'+esc(x.id)+'">حذف</button></article>').join("") || '<div class="empty">هنوز اطلاعاتی برای این عضو ثبت نشده است.</div>';
    const body='<div class="section"><div><h2>پنل اختصاصی '+esc(member.full_name)+'</h2><p>'+esc(member.email)+' • '+(member.is_active?'فعال':'غیرفعال')+'</p></div><button class="btn" data-go="members">بازگشت</button></div>'+
      '<div class="panel"><div class="panelhead"><h2>＋ ارسال اطلاعات به این عضو</h2></div><form id="entryForm"><input type="hidden" name="member_id" value="'+esc(id)+'"><div class="formgrid"><div class="field full"><label>عنوان</label><input name="title" required maxlength="180"></div><div class="field full"><label>متن اطلاعات خصوصی</label><textarea name="body" required maxlength="10000"></textarea></div></div><div class="actions"><button class="btn primary">ذخیره در پنل این عضو</button></div></form></div>'+
      '<div class="panel"><div class="panelhead"><h2>اطلاعات ذخیره‌شده</h2><span class="badge">'+(entries||[]).length+' مورد</span></div>'+entryHTML+'</div>';
    shell("پنل اختصاصی عضو","هر مورد فقط برای صاحب همین حساب قابل مشاهده است",body,true);
    $("#entryForm").addEventListener("submit",saveEntry);
    document.querySelectorAll("[data-delete-entry]").forEach(b=>b.addEventListener("click",()=>deleteEntry(b.dataset.deleteEntry,id)));
  }
  async function saveEntry(ev) {
    ev.preventDefault();const f=new FormData(ev.currentTarget);
    const {error}=await client.from("member_entries").insert({member_id:String(f.get("member_id")),created_by:authUser.id,title:String(f.get("title")).trim(),body:String(f.get("body")).trim()});
    if(error){notice("ذخیره انجام نشد: "+error.message,"error");return;}
    await openMember(String(f.get("member_id")));notice("اطلاعات در پنل عضو ذخیره شد.","success");
  }
  async function deleteEntry(entryId,memberId) {
    if(!confirm("این اطلاعات حذف شود؟"))return;
    const {error}=await client.from("member_entries").delete().eq("id",entryId);
    if(error){notice("حذف انجام نشد: "+error.message,"error");return;}
    await openMember(memberId);notice("اطلاعات حذف شد.","success");
  }
  async function adminAnnouncements() {
    const {data,error}=await client.from("announcements").select("id,title,body,created_at").order("created_at",{ascending:false});
    if(error){notice(error.message,"error");return;}
    const list=(data||[]).map(a=>'<article class="notice"><h3>'+esc(a.title)+'</h3><p>'+esc(a.body)+'</p><small>'+esc(new Date(a.created_at).toLocaleString("fa-IR"))+'</small><button class="btn small danger" data-del-notice="'+esc(a.id)+'">حذف اطلاعیه</button></article>').join("")||'<div class="empty">اطلاعیه‌ای ثبت نشده است.</div>';
    const body='<div class="section"><div><h2>اطلاعیه عمومی</h2><p>این پیام برای همه اعضای فعال نمایش داده می‌شود.</p></div></div><div class="panel"><form id="noticeForm"><div class="formgrid"><div class="field full"><label>عنوان اطلاعیه</label><input name="title" required maxlength="180"></div><div class="field full"><label>متن</label><textarea name="body" required maxlength="10000"></textarea></div></div><div class="actions"><button class="btn primary">انتشار اطلاعیه</button></div></form></div><div class="panel"><div class="panelhead"><h2>اطلاعیه‌های منتشرشده</h2></div>'+list+'</div>';
    shell("اطلاعیه عمومی","پیام‌های همگانی برای کاربران",body,true);
    $("#noticeForm").addEventListener("submit",publishNotice);
    document.querySelectorAll("[data-del-notice]").forEach(b=>b.addEventListener("click",()=>deleteNotice(b.dataset.delNotice)));
  }
  async function publishNotice(ev) {
    ev.preventDefault();const f=new FormData(ev.currentTarget);
    const {error}=await client.from("announcements").insert({title:String(f.get("title")).trim(),body:String(f.get("body")).trim(),created_by:authUser.id});
    if(error){notice("انتشار ناموفق بود: "+error.message,"error");return;}
    await adminAnnouncements();notice("اطلاعیه منتشر شد.","success");
  }
  async function deleteNotice(id) {
    if(!confirm("اطلاعیه حذف شود؟"))return;
    const {error}=await client.from("announcements").delete().eq("id",id);
    if(error){notice(error.message,"error");return;}
    await adminAnnouncements();notice("اطلاعیه حذف شد.","success");
  }
  async function memberHome() {
    const [{data:entries,error:e1},{data:notices,error:e2}]=await Promise.all([
      client.from("member_entries").select("id,title,body,created_at").eq("member_id",authUser.id).order("created_at",{ascending:false}),
      client.from("announcements").select("id,title,body,created_at").eq("is_active",true).order("created_at",{ascending:false})
    ]);
    if(e1||e2){loginView();notice("بارگیری پنل انجام نشد. دسترسی پایگاه داده را بررسی کن.","error");return;}
    const entryHTML=(entries||[]).map(x=>'<article class="entry"><h3>'+esc(x.title)+'</h3><p>'+esc(x.body)+'</p><small>'+esc(new Date(x.created_at).toLocaleString("fa-IR"))+'</small></article>').join("")||'<div class="empty">هنوز اطلاعات اختصاصی برای حساب شما ثبت نشده است.</div>';
    const noticeHTML=(notices||[]).map(x=>'<article class="notice"><h3>'+esc(x.title)+'</h3><p>'+esc(x.body)+'</p><small>'+esc(new Date(x.created_at).toLocaleString("fa-IR"))+'</small></article>').join("")||'<div class="empty">اطلاعیه عمومی جدیدی وجود ندارد.</div>';
    const body='<div class="hero"><h2>سلام '+esc(profile.full_name)+'، خوش آمدی</h2><p>این پنل شخصی توست. پیام‌ها و اطلاعاتی که مدیر برایت می‌فرستد فقط در حساب تو نمایش داده می‌شود.</p></div><div class="grid"><div class="stat"><small>اطلاعات اختصاصی</small><strong>'+(entries||[]).length+'</strong></div><div class="stat"><small>اطلاعیه عمومی</small><strong>'+(notices||[]).length+'</strong></div></div><div class="panel"><div class="panelhead"><h2>اطلاعات اختصاصی من</h2><span class="badge">خصوصی</span></div>'+entryHTML+'</div><div class="panel"><div class="panelhead"><h2>اطلاعیه‌های مجموعه</h2></div>'+noticeHTML+'</div>';
    shell("پنل اختصاصی من","اطلاعات حساب شخصی شما",body,false);
  }
  function passwordPage() {
    const body='<div class="panel passwordbox"><div class="panelhead"><h2>تغییر رمز عبور</h2></div><p class="muted">رمز قوی و غیرقابل حدس انتخاب کن. حداقل ۱۰ نویسه پیشنهاد می‌شود.</p><form id="passwordForm"><div class="field"><label>رمز جدید</label><input name="password" type="password" minlength="10" required dir="ltr" autocomplete="new-password"></div><div class="field"><label>تکرار رمز جدید</label><input name="confirm" type="password" minlength="10" required dir="ltr" autocomplete="new-password"></div><button class="btn primary">ذخیره رمز جدید</button></form></div>';
    shell("تغییر رمز عبور","امنیت حساب کاربری",body,profile.role==="admin");
    $("#passwordForm").addEventListener("submit",async ev=>{
      ev.preventDefault();const f=new FormData(ev.currentTarget),p=String(f.get("password"));
      if(p!==String(f.get("confirm"))){notice("تکرار رمز یکسان نیست.","error");return;}
      const {error}=await client.auth.updateUser({password:p});
      if(error)notice("تغییر رمز انجام نشد: "+error.message,"error");else notice("رمز عبور تغییر کرد.","success");
    });
  }
  async function navigate(where) {
    if(where==="home"){if(profile.role==="admin")await adminHome();else await memberHome();}
    else if(where==="members" && profile.role==="admin")await adminMembers();
    else if(where==="announcements" && profile.role==="admin")await adminAnnouncements();
    else if(where==="password")passwordPage();
  }
  async function start() {
    if(!cfg.supabaseUrl || cfg.supabaseUrl.includes("YOUR-PROJECT") || !cfg.supabaseAnonKey || cfg.supabaseAnonKey.includes("YOUR_SUPABASE")){configProblem();return;}
    if(!window.supabase?.createClient){app.innerHTML='<div class="auth-wrap"><main class="auth-card"><h1>اتصال کتابخانه ناموفق بود</h1><p class="muted">اینترنت و دسترسی به CDN را بررسی کن و صفحه را دوباره بارگذاری کن.</p></main></div>';return;}
    client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    const {data:{session}}=await client.auth.getSession();
    if(session)await loadProfile();else loginView();
    client.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){authUser=null;profile=null;loginView();}
    });
  }
  start().catch(err=>{console.error(err);app.innerHTML='<div class="auth-wrap"><main class="auth-card"><h1>خطای اتصال</h1><p class="muted">'+esc(err.message||"خطای ناشناخته")+'</p></main></div>';});
})();