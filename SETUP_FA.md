# راه‌اندازی سایت سربازان امام زمان با GitHub Pages و Supabase

این نسخه برای GitHub Pages ساخته شده است. GitHub فقط فایل‌های ظاهر سایت (HTML/CSS/JavaScript) را میزبانی می‌کند؛ ورود و پایگاه داده مرکزی با Supabase انجام می‌شود. GitHub Pages زبان PHP را اجرا نمی‌کند.

## ۱) ساخت پروژه Supabase
1. وارد https://supabase.com شوید و یک حساب بسازید.
2. یک پروژه جدید بسازید و رمز پایگاه داده را در جای امن نگه دارید.
3. از بخش SQL Editor فایل `supabase/schema.sql` همین مخزن را باز کنید، تمام کد آن را اجرا کنید.
4. در بخش Authentication > Users یک کاربر برای خودتان ایجاد کنید. ایمیل و رمز قوی انتخاب کنید.
5. به SQL Editor برگردید و این دستور را با ایمیل خودتان اجرا کنید:
   `update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';`
   مقدار ایمیل را با ایمیل واقعی مدیر جایگزین کنید.
6. در Project Settings > API، Project URL و کلید عمومی anon/publishable را بردارید.

## ۲) اتصال GitHub Pages به Supabase
1. فایل `config.js` را در GitHub باز کنید و روی مداد (Edit) بزنید.
2. `YOUR-PROJECT-REF` را با آدرس واقعی پروژه و `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` را با کلید عمومی جایگزین کنید.
3. فقط کلید عمومی anon/publishable مجاز است. **هرگز service_role یا secret key را در GitHub، HTML، JavaScript یا مرورگر قرار ندهید.**
4. ذخیره (Commit changes) کنید.

## ۳) فعال‌کردن GitHub Pages
1. در مخزن GitHub روی Settings کلیک کنید.
2. از منوی سمت چپ Pages را باز کنید.
3. در بخش Build and deployment گزینه Deploy from a branch را انتخاب کنید.
4. Branch را روی main و Folder را روی /(root) بگذارید و Save بزنید.
5. پس از پایان انتشار، نشانی Pages در همان صفحه نمایش داده می‌شود. چند دقیقه برای انتشار اولیه زمان لازم است.

## ۴) فعال‌کردن ساخت حساب از داخل پنل مدیر
این بخش باعث می‌شود مدیر بتواند از داخل سایت برای هر عضو ایمیل و رمز بسازد. کلید محرمانه فقط در محیط Supabase Edge Function استفاده می‌شود.

نیاز به نصب Supabase CLI روی رایانه دارد. اگر Node.js نصب است:
```bash
npm install -g supabase
supabase login
```
در داشبورد Supabase، Project Settings > General، شناسه پروژه (Project Ref) را بردارید. سپس در پوشه‌ای که این مخزن را clone کرده‌اید:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy create-member
```
Edge Function در محیط سرور Supabase از کلید محرمانه استفاده می‌کند. در صورت نیاز کلید محرمانه را از Edge Function Secrets با نام `SUPABASE_SERVICE_ROLE_KEY` تنظیم کنید. **این کلید را هرگز در مخزن GitHub قرار ندهید.**

## ۵) استفاده
- با ایمیل و رمز مدیر وارد سایت شوید.
- به «مدیریت اعضا» بروید.
- نام، ایمیل و رمز اولیه عضو را وارد و حساب را بسازید.
- رمز را به‌شکل امن به خود عضو تحویل دهید.
- از بخش «پنل اختصاصی» برای همان عضو اطلاعات ثبت کنید.
- عضو با ایمیل و رمز خودش وارد می‌شود و فقط اطلاعات خودش را می‌بیند.

## امنیت
- سیاست‌های Row Level Security (RLS) در PostgreSQL دسترسی‌ها را در سمت پایگاه داده محدود می‌کنند؛ صرفاً مخفی‌کردن بخش‌های رابط کاربری نیست.
- رمز عبور توسط Supabase Auth مدیریت می‌شود و این پروژه رمز خام کاربران را در جدول عمومی نگه نمی‌دارد.
- سایت را با HTTPS منتشر کنید.
- برای مدیر و اعضا رمزهای یکتا و قوی انتخاب کنید.
- از داده‌های پروژه به‌صورت منظم نسخه پشتیبان تهیه کنید.
- کلید anon/publishable در مرورگر قابل مشاهده است و باید فقط همراه با RLS درست استفاده شود؛ کلید secret/service_role محرمانه است.

## رفع اشکال
- اگر پیام «تنظیم اولیه» دیدید، هنوز config.js را پر نکرده‌اید.
- اگر ورود ناموفق بود، کاربر را در Supabase Authentication > Users بررسی کنید.
- اگر مدیر پنل مدیر را نمی‌بیند، دستور UPDATE نقش مدیر در SQL Editor اجرا نشده است.
- اگر ساخت عضو خطا داد، Edge Function را deploy کنید و لاگ‌های آن را در Supabase بررسی کنید.
