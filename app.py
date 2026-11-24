import os,re,secrets,sqlite3,hmac
from functools import wraps
from flask import Flask,request,session,redirect,url_for,flash,render_template_string,abort
from werkzeug.security import generate_password_hash,check_password_hash
from markupsafe import escape

ROOT=os.path.dirname(os.path.abspath(__file__))
DB_PATH=os.environ.get("DATABASE_PATH",os.path.join(ROOT,"sarbazan.db"))
app=Flask(__name__)
app.secret_key=os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SAMESITE="Lax",SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE","1")=="1",PERMANENT_SESSION_LIFETIME=28800,MAX_CONTENT_LENGTH=1048576)

def db():
 c=sqlite3.connect(DB_PATH,timeout=20);c.row_factory=sqlite3.Row;c.execute("PRAGMA foreign_keys=ON");return c
def init_db():
 os.makedirs(os.path.dirname(DB_PATH) or ".",exist_ok=True)
 with db() as c:
  c.executescript("""
  CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE COLLATE NOCASE NOT NULL,full_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','member')),active INTEGER NOT NULL DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY,full_name TEXT NOT NULL,email TEXT NOT NULL COLLATE NOCASE,phone TEXT,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at TEXT DEFAULT CURRENT_TIMESTAMP,reviewed_at TEXT);
  CREATE TABLE IF NOT EXISTS private_notes(id INTEGER PRIMARY KEY,member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS notes_member_idx ON private_notes(member_id);
  CREATE INDEX IF NOT EXISTS req_status_idx ON requests(status,created_at);
  """)
  em=os.environ.get("ADMIN_EMAIL","").strip().lower();pw=os.environ.get("ADMIN_PASSWORD","")
  if em and pw and not c.execute("SELECT 1 FROM users WHERE email=?",(em,)).fetchone():
   c.execute("INSERT INTO users(email,full_name,password_hash,role) VALUES(?,?,?,'admin')",(em,os.environ.get("ADMIN_NAME","مدیر سامانه"),generate_password_hash(pw)))
  c.commit()
init_db()

BASE="""<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='theme-color' content='#091322'><title>{{title}} | سربازان امام زمان</title><link href='https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap' rel='stylesheet'><style>
:root{--bg:#091322;--panel:#14283f;--line:#ffffff1b;--txt:#eff6ff;--muted:#9bb0c9;--cyan:#55d8e9;--blue:#8795ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(850px 500px at 100% 0%,#354c902b,transparent 60%),var(--bg);color:var(--txt);font-family:Vazirmatn,Tahoma,sans-serif;min-height:100vh}.wrap{width:min(1180px,calc(100% - 30px));margin:auto}.top{display:flex;justify-content:space-between;align-items:center;padding:22px 0;gap:15px}.brand{display:flex;align-items:center;gap:12px}.logo{width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,var(--cyan),var(--blue));display:grid;place-items:center;color:#061522;font-size:26px;font-weight:800}.brand b{display:block;font-size:15px}.brand small,.muted{color:var(--muted)}.brand small{font-size:10px}.user{display:flex;align-items:center;gap:10px;font-size:12px}.card{background:linear-gradient(145deg,#152a43f5,#101e30f5);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 20px 65px #0003}.hero{background:linear-gradient(110deg,#193353,#164d5a);border:1px solid #55d8e944;border-radius:22px;padding:26px;margin:12px 0 18px}.hero h1{margin:0 0 8px;font-size:25px}.hero p{margin:0;color:#c8d9e9;line-height:2;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:16px 0}.stat{padding:18px;border-radius:17px;background:var(--panel);border:1px solid var(--line)}.stat small{color:var(--muted)}.stat strong{display:block;font-size:27px;margin-top:5px}.section{margin:20px 0 10px;font-size:17px}.field{display:grid;gap:7px;margin:12px 0}.field label{font-size:12px;color:#c5d5e7}.field input,.field textarea{width:100%;background:#09192b;border:1px solid var(--line);color:var(--txt);border-radius:12px;padding:12px;outline:none}.field textarea{min-height:110px;resize:vertical}.btn{border:1px solid var(--line);background:#203852;color:var(--txt);border-radius:11px;padding:10px 15px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;justify-content:center;align-items:center;gap:7px}.btn.primary{background:linear-gradient(110deg,var(--cyan),var(--blue));color:#061522;border:0}.btn.good{background:#174535;color:#caffea}.btn.danger{background:#4a2638;color:#ffdae3}.btn.small{padding:7px 10px;font-size:11px}.btn.wide{width:100%;margin-top:7px}.actions{display:flex;gap:7px;flex-wrap:wrap}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:15px 0}.tabs a{padding:9px 13px;background:#152b43;border:1px solid var(--line);border-radius:10px;font-size:12px;color:var(--txt);text-decoration:none}.tabs a.active{background:#23516a;border-color:#55d8e966}.flash{padding:12px 15px;border-radius:12px;background:#163c39;border:1px solid #45d5a455;margin:12px 0;font-size:12px;line-height:1.9}.flash.error{background:#482638;border-color:#ff779055}.flash.warn{background:#493b22;border-color:#f4cc7d55}.tablebox{overflow:auto;border:1px solid var(--line);border-radius:15px}table{width:100%;border-collapse:collapse;min-width:650px}th,td{padding:12px;text-align:right;border-bottom:1px solid var(--line);font-size:12px}th{color:var(--muted);background:#ffffff08}.pill{font-size:10px;padding:4px 9px;border-radius:20px;background:#25465a}.pill.pending{background:#514122;color:#ffe3a6}.pill.approved{background:#174535;color:#bfffe5}.pill.rejected{background:#492638;color:#ffd7e0}.note{padding:16px;border:1px solid var(--line);background:var(--panel);border-radius:15px;margin:10px 0}.note h3{font-size:14px;margin:0 0 8px}.note p{white-space:pre-wrap;line-height:2;font-size:12px;margin:0;color:#d3e0ee}.auth{min-height:85vh;display:grid;place-items:center}.auth .card{width:min(470px,100%)}.center{text-align:center}.smalltext{font-size:11px;line-height:2}.empty{padding:24px;text-align:center;color:var(--muted);font-size:12px}.footer{text-align:center;color:#6f86a1;font-size:10px;padding:30px 0}@media(max-width:760px){.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.hero h1{font-size:21px}.card{padding:17px}}
</style></head><body><div class='wrap'><header class='top'><div class='brand'><div class='logo'>✦</div><div><b>سربازان امام زمان</b><small>سامانه یکپارچه فرهنگی</small></div></div>{% if user %}<div class='user'><span>{{user.full_name}}</span><form method='post' action='{{url_for("logout")}}'><input type='hidden' name='csrf' value='{{csrf}}'><button class='btn small'>خروج</button></form></div>{% endif %}</header>{% with messages=get_flashed_messages(with_categories=true) %}{% for cat,msg in messages %}<div class='flash {{ "error" if cat=="error" else ("warn" if cat=="warn" else "") }}'>{{msg}}</div>{% endfor %}{% endwith %}{{content|safe}}<footer class='footer'>سامانه خصوصی سربازان امام زمان • نسخه Python و SQLite</footer></div></body></html>"""

def page(content,title="پنل",user=None):
 if "csrf" not in session: session["csrf"]=secrets.token_urlsafe(24)
 inner=render_template_string(content,csrf=session["csrf"],url_for=url_for)
 return render_template_string(BASE,content=inner,title=title,user=user)
def csrf():
 if not session.get("csrf") or not hmac.compare_digest(session["csrf"],request.form.get("csrf","")): abort(400)
def me():
 uid=session.get("uid")
 if not uid:return None
 with db() as c:return c.execute("SELECT id,email,full_name,role,active FROM users WHERE id=?",(uid,)).fetchone()
def logged(fn):
 @wraps(fn)
 def w(*a,**k):
  u=me()
  if not u or not u["active"]:session.clear();return redirect(url_for("login"))
  return fn(*a,**k)
 return w
def admin_only(fn):
 @wraps(fn)
 @logged
 def w(*a,**k):
  if me()["role"]!="admin":abort(403)
  return fn(*a,**k)
 return w
def nav(active):
 links=[("admin","نمای کلی"),("members_page","اعضا"),("requests_page","درخواست‌های عضویت"),("announcements","اطلاعیه‌ها")]
 return '<nav class="tabs">'+''.join(f'<a class="{"active" if endpoint==active else ""}" href="{url_for(endpoint)}">{label}</a>' for endpoint,label in links)+'</nav>'
def hero(t,s):return f'<section class="hero"><h1>{escape(t)}</h1><p>{escape(s)}</p></section>'

@app.get("/")
def index():return redirect(url_for("dashboard") if me() else url_for("login"))
@app.route("/login",methods=["GET","POST"])
def login():
 if me():return redirect(url_for("dashboard"))
 if request.method=="POST":
  csrf();email=request.form.get("email","").strip().lower();pw=request.form.get("password","")
  with db() as c:u=c.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone()
  if u and u["active"] and check_password_hash(u["password_hash"],pw):
   session.clear();session["uid"]=u["id"];session.permanent=True;return redirect(url_for("dashboard"))
  flash("ایمیل یا رمز عبور اشتباه است، یا حساب غیرفعال شده است.","error")
 content="""<div class='auth'><main class='card'><div class='center'><div class='logo' style='margin:auto'>✦</div><p class='muted smalltext'>ورود امن به سامانه فرهنگی</p><h2>سربازان امام زمان</h2><p class='muted smalltext'>اطلاعات حسابی را که مدیر در اختیارت گذاشته وارد کن.</p></div><form method='post'><input type='hidden' name='csrf' value='{{csrf}}'><div class='field'><label>ایمیل</label><input name='email' type='email' required maxlength='254' dir='ltr' autocomplete='username'></div><div class='field'><label>رمز عبور</label><input name='password' type='password' required autocomplete='current-password'></div><button class='btn primary wide'>ورود به پنل</button></form><a class='btn wide' href='{{url_for("request_access")}}'>＋ درخواست ساخت حساب جدید</a></main></div>"""
 return page(content,"ورود")
@app.route("/request",methods=["GET","POST"])
def request_access():
 if request.method=="POST":
  csrf();name=request.form.get("full_name","").strip();email=request.form.get("email","").strip().lower();phone=request.form.get("phone","").strip();reason=request.form.get("reason","").strip()
  if request.form.get("website",""):abort(400)
  if len(name)<3 or len(name)>120 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email) or len(email)>254 or len(reason)<8 or len(reason)>1200:flash("اطلاعات واردشده معتبر نیست.","error")
  else:
   with db() as c:
    if c.execute("SELECT 1 FROM users WHERE email=?",(email,)).fetchone():flash("برای این ایمیل حساب وجود دارد.","warn")
    elif c.execute("SELECT 1 FROM requests WHERE email=? AND status='pending'",(email,)).fetchone():flash("درخواست قبلی هنوز در انتظار بررسی است.","warn")
    else:c.execute("INSERT INTO requests(full_name,email,phone,reason) VALUES(?,?,?,?)",(name,email,phone[:32],reason));c.commit();flash("درخواست ثبت شد؛ پس از بررسی مدیر نتیجه را از راه ارتباطی مجموعه پیگیری کن.","");return redirect(url_for("request_access"))
 content="""<div class='auth'><main class='card'><div class='logo'>✦</div><h2>درخواست ساخت حساب</h2><p class='muted smalltext'>حساب فقط پس از تأیید مدیر ساخته می‌شود.</p><form method='post'><input type='hidden' name='csrf' value='{{csrf}}'><div class='field'><label>نام و نام خانوادگی</label><input name='full_name' required minlength='3' maxlength='120'></div><div class='field'><label>ایمیل</label><input name='email' type='email' required maxlength='254' dir='ltr'></div><div class='field'><label>شماره تماس (اختیاری)</label><input name='phone' maxlength='32'></div><div class='field'><label>علت درخواست</label><textarea name='reason' required minlength='8' maxlength='1200'></textarea></div><div style='position:absolute;left:-9999px'><input name='website' tabindex='-1'></div><button class='btn primary wide'>ارسال درخواست</button></form><a class='btn wide' href='{{url_for("login")}}'>بازگشت به ورود</a></main></div>"""
 return page(content,"درخواست عضویت")
@app.post("/logout")
@logged
def logout():csrf();session.clear();return redirect(url_for("login"))
@app.get("/dashboard")
@logged
def dashboard():
 u=me()
 if u["role"]=="admin":return redirect(url_for("admin"))
 with db() as c:
  notes=c.execute("SELECT * FROM private_notes WHERE member_id=? ORDER BY id DESC",(u["id"],)).fetchall()
  ann=c.execute("SELECT * FROM announcements ORDER BY id DESC LIMIT 30").fetchall()
 body=hero("پنل اختصاصی "+u["full_name"],"این بخش فقط برای حساب خودت و مدیر سامانه قابل مشاهده است.")+'<h2 class="section">اطلاعات اختصاصی من</h2>'
 body+=''.join(f'<article class="note"><h3>{escape(n["title"])}</h3><p>{escape(n["body"])}</p><small class="muted">{escape(n["created_at"])}</small></article>' for n in notes) or '<div class="card empty">هنوز اطلاعات اختصاصی ثبت نشده است.</div>'
 body+='<h2 class="section">اطلاعیه‌های مجموعه</h2>'+''.join(f'<article class="note"><h3>{escape(n["title"])}</h3><p>{escape(n["body"])}</p></article>' for n in ann) or '<div class="card empty">اطلاعیه‌ای ثبت نشده است.</div>'
 return page(body,"پنل عضو",u)
@app.get("/admin")
@admin_only
def admin():
 u=me()
 with db() as c:
  m=c.execute("SELECT COUNT(*) n FROM users WHERE role='member'").fetchone()["n"];r=c.execute("SELECT COUNT(*) n FROM requests WHERE status='pending'").fetchone()["n"];n=c.execute("SELECT COUNT(*) n FROM private_notes").fetchone()["n"]
 body=hero("مرکز مدیریت فرهنگی","اعضا، درخواست‌های عضویت و پیام‌های خصوصی را مدیریت کن.")+nav("admin")+f'<div class="grid"><div class="stat"><small>اعضای ثبت‌شده</small><strong>{m}</strong></div><div class="stat"><small>درخواست‌های منتظر</small><strong>{r}</strong></div><div class="stat"><small>پیام‌های خصوصی</small><strong>{n}</strong></div></div><div class="card"><h3>راهنمای مدیر</h3><p class="muted smalltext">درخواست را بررسی کن؛ با تأیید، حساب و رمز موقت ساخته می‌شود. رمز را فقط از راه امن به صاحب حساب بده.</p><a href="/change-password" class="btn">تغییر رمز مدیر</a></div>'
 return page(body,"مدیریت",u)
@app.get("/admin/requests")
@admin_only
def requests_page():
 u=me()
 with db() as c:rows=c.execute("SELECT * FROM requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 200").fetchall()
 body=hero("درخواست‌های عضویت","درخواست‌ها فقط برای مدیر قابل مشاهده‌اند.")+nav("requests_page")
 body+='<div class="tablebox"><table><tr><th>نام</th><th>ایمیل</th><th>تماس</th><th>توضیح</th><th>وضعیت</th><th>عملیات</th></tr>'
 for r in rows:
  body+=f'<tr><td>{escape(r["full_name"])}</td><td dir="ltr">{escape(r["email"])}</td><td>{escape(r["phone"] or "")}</td><td>{escape(r["reason"])}</td><td><span class="pill {r["status"]}">{r["status"]}</span></td><td>'
  if r["status"]=="pending":body+=f'<form class="actions" method="post" action="{url_for("review_request",rid=r["id"])}"><input type="hidden" name="csrf" value="{escape(session["csrf"])}"><button class="btn good small" name="decision" value="approve">تأیید و ساخت حساب</button><button class="btn danger small" name="decision" value="reject">رد</button></form>'
  body+='</td></tr>'
 body+='</table></div>' if rows else '<div class="card empty">درخواستی وجود ندارد.</div>'
 return page(body,"درخواست‌ها",u)
@app.post("/admin/requests/<int:rid>/review")
@admin_only
def review_request(rid):
 csrf();decision=request.form.get("decision")
 if decision not in ("approve","reject"):abort(400)
 with db() as c:
  r=c.execute("SELECT * FROM requests WHERE id=? AND status='pending'",(rid,)).fetchone()
  if not r:flash("درخواست قبلاً بررسی شده است.","warn")
  elif decision=="reject":c.execute("UPDATE requests SET status='rejected',reviewed_at=CURRENT_TIMESTAMP WHERE id=?",(rid,));c.commit();flash("درخواست رد شد.","")
  elif c.execute("SELECT 1 FROM users WHERE email=?",(r["email"],)).fetchone():flash("برای این ایمیل حساب وجود دارد.","error")
  else:
   temp=secrets.token_urlsafe(9);c.execute("INSERT INTO users(email,full_name,password_hash,role) VALUES(?,?,?,'member')",(r["email"],r["full_name"],generate_password_hash(temp)));c.execute("UPDATE requests SET status='approved',reviewed_at=CURRENT_TIMESTAMP WHERE id=?",(rid,));c.commit();flash("حساب ساخته شد. رمز موقت را همین حالا امن تحویل بده: "+temp,"warn")
 return redirect(url_for("requests_page"))
@app.get("/admin/members")
@admin_only
def members_page():
 u=me()
 with db() as c:rows=c.execute("SELECT id,email,full_name,active FROM users WHERE role='member' ORDER BY id DESC").fetchall()
 body=hero("مدیریت اعضا","پرونده اختصاصی هر عضو را باز کن.")+nav("members_page")+'<div class="tablebox"><table><tr><th>نام</th><th>ایمیل</th><th>وضعیت</th><th>عملیات</th></tr>'
 for m in rows:
  body+=f'<tr><td>{escape(m["full_name"])}</td><td dir="ltr">{escape(m["email"])}</td><td>{"فعال" if m["active"] else "غیرفعال"}</td><td><a class="btn primary small" href="{url_for("member_detail",mid=m["id"])}">پرونده خصوصی</a> <form style="display:inline" method="post" action="{url_for("toggle_member",mid=m["id"])}"><input type="hidden" name="csrf" value="{escape(session["csrf"])}"><button class="btn small">{"غیرفعال‌کردن" if m["active"] else "فعال‌کردن"}</button></form></td></tr>'
 body+='</table></div>' if rows else '<div class="card empty">هنوز عضوی وجود ندارد.</div>'
 body+='<div class="card" style="margin-top:15px"><h3>ساخت حساب عضو</h3><form method="post" action="'+url_for("create_member")+'"><input type="hidden" name="csrf" value="'+str(escape(session["csrf"]))+'"><div class="field"><label>نام کامل</label><input name="full_name" required maxlength="120"></div><div class="field"><label>ایمیل</label><input name="email" type="email" required dir="ltr"></div><button class="btn primary">ساخت حساب و نمایش رمز موقت</button></form></div>'
 return page(body,"اعضا",u)
@app.get("/admin/members/<int:mid>")
@admin_only
def member_detail(mid):
 u=me()
 with db() as c:
  m=c.execute("SELECT * FROM users WHERE id=? AND role='member'",(mid,)).fetchone()
  if not m:abort(404)
  notes=c.execute("SELECT * FROM private_notes WHERE member_id=? ORDER BY id DESC",(mid,)).fetchall()
 body=hero("پرونده خصوصی "+m["full_name"],"اطلاعات این صفحه فقط برای همین عضو و مدیر قابل مشاهده است.")+nav("members_page")
 body+=f'<div class="card"><p dir="ltr">{escape(m["email"])}</p><form method="post" action="{url_for("add_note",mid=mid)}"><input type="hidden" name="csrf" value="{escape(session["csrf"])}"><div class="field"><label>عنوان</label><input name="title" required maxlength="160"></div><div class="field"><label>متن خصوصی</label><textarea name="body" required maxlength="10000"></textarea></div><button class="btn primary">ثبت اطلاعات خصوصی</button></form></div><h2 class="section">سوابق</h2>'
 body+=''.join(f'<article class="note"><h3>{escape(n["title"])}</h3><p>{escape(n["body"])}</p><form method="post" action="{url_for("delete_note",nid=n["id"])}"><input type="hidden" name="csrf" value="{escape(session["csrf"])}"><button class="btn danger small">حذف</button></form></article>' for n in notes) or '<div class="card empty">پیامی ثبت نشده است.</div>'
 return page(body,"پرونده عضو",u)
@app.post("/admin/members/create")
@admin_only
def create_member():
 csrf();name=request.form.get("full_name","").strip();email=request.form.get("email","").strip().lower()
 if len(name)<3 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email):flash("نام یا ایمیل معتبر نیست.","error")
 else:
  temp=secrets.token_urlsafe(9)
  try:
   with db() as c:c.execute("INSERT INTO users(email,full_name,password_hash,role) VALUES(?,?,?,'member')",(email,name,generate_password_hash(temp)));c.commit()
   flash("حساب ساخته شد. رمز موقت را امن تحویل بده: "+temp,"warn")
  except sqlite3.IntegrityError:flash("این ایمیل قبلاً ثبت شده است.","error")
 return redirect(url_for("members_page"))
@app.post("/admin/members/<int:mid>/toggle")
@admin_only
def toggle_member(mid):
 csrf()
 with db() as c:c.execute("UPDATE users SET active=CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id=? AND role='member'",(mid,));c.commit()
 return redirect(url_for("members_page"))
@app.post("/admin/notes/<int:nid>/delete")
@admin_only
def delete_note(nid):
 csrf()
 with db() as c:c.execute("DELETE FROM private_notes WHERE id=?",(nid,));c.commit()
 return redirect(request.referrer or url_for("members_page"))
@app.post("/admin/members/<int:mid>/notes")
@admin_only
def add_note(mid):
 csrf();title=request.form.get("title","").strip();body=request.form.get("body","").strip()
 with db() as c:
  if not c.execute("SELECT 1 FROM users WHERE id=? AND role='member'",(mid,)).fetchone():abort(404)
  if title and body and len(title)<=160 and len(body)<=10000:c.execute("INSERT INTO private_notes(member_id,title,body) VALUES(?,?,?)",(mid,title,body));c.commit();flash("اطلاعات خصوصی ثبت شد.","")
  else:flash("عنوان یا متن معتبر نیست.","error")
 return redirect(url_for("member_detail",mid=mid))
@app.route("/admin/announcements",methods=["GET","POST"])
@admin_only
def announcements():
 u=me()
 if request.method=="POST":
  csrf();title=request.form.get("title","").strip();body=request.form.get("body","").strip()
  if title and body and len(title)<=160 and len(body)<=10000:
   with db() as c:c.execute("INSERT INTO announcements(title,body) VALUES(?,?)",(title,body));c.commit()
   flash("اطلاعیه منتشر شد.","")
  else:flash("عنوان یا متن معتبر نیست.","error")
  return redirect(url_for("announcements"))
 with db() as c:rows=c.execute("SELECT * FROM announcements ORDER BY id DESC").fetchall()
 body=hero("اطلاعیه‌های عمومی","این پیام‌ها برای همه اعضای واردشده نمایش داده می‌شوند.")+nav("announcements")
 body+='<div class="card"><form method="post"><input type="hidden" name="csrf" value="'+str(escape(session["csrf"]))+'"><div class="field"><label>عنوان</label><input name="title" required maxlength="160"></div><div class="field"><label>متن اطلاعیه</label><textarea name="body" required maxlength="10000"></textarea></div><button class="btn primary">انتشار</button></form></div>'
 body+=''.join(f'<article class="note"><h3>{escape(n["title"])}</h3><p>{escape(n["body"])}</p></article>' for n in rows)
 return page(body,"اطلاعیه‌ها",u)
@app.route("/change-password",methods=["GET","POST"])
@logged
def change_password():
 u=me()
 if request.method=="POST":
  csrf();old=request.form.get("old_password","");new=request.form.get("new_password","")
  with db() as c:r=c.execute("SELECT password_hash FROM users WHERE id=?",(u["id"],)).fetchone()
  if not check_password_hash(r["password_hash"],old):flash("رمز فعلی اشتباه است.","error")
  elif len(new)<10:flash("رمز جدید باید حداقل ۱۰ نویسه باشد.","error")
  else:
   with db() as c:c.execute("UPDATE users SET password_hash=? WHERE id=?",(generate_password_hash(new),u["id"]));c.commit()
   flash("رمز تغییر کرد.","");return redirect(url_for("dashboard"))
 content="""<div class='card' style='max-width:520px;margin:25px auto'><h2>تغییر رمز عبور</h2><form method='post'><input type='hidden' name='csrf' value='{{csrf}}'><div class='field'><label>رمز فعلی</label><input type='password' name='old_password' required></div><div class='field'><label>رمز جدید (حداقل ۱۰ نویسه)</label><input type='password' name='new_password' minlength='10' required></div><button class='btn primary'>ذخیره رمز جدید</button></form><a class='btn' href='/'>بازگشت</a></div>"""
 return page(content,"تغییر رمز",u)
@app.errorhandler(403)
def forbidden(e):return page('<div class="card empty"><h2>دسترسی غیرمجاز</h2><a class="btn" href="/">بازگشت</a></div>',"خطای دسترسی",me()),403
@app.errorhandler(404)
def missing(e):return page('<div class="card empty"><h2>صفحه پیدا نشد</h2><a class="btn" href="/">بازگشت</a></div>',"یافت نشد",me()),404
@app.after_request
def headers(r):
 r.headers["X-Content-Type-Options"]="nosniff";r.headers["X-Frame-Options"]="DENY";r.headers["Referrer-Policy"]="strict-origin-when-cross-origin";r.headers["Cache-Control"]="no-store";return r
if __name__=="__main__":app.run(host="0.0.0.0",port=int(os.environ.get("PORT",5000)),debug=False)
