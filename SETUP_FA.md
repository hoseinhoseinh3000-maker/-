# راه‌اندازی دقیق سایت سربازان امام زمان

این سامانه از دو بخش تشکیل شده است:
- GitHub Pages: نمایش سایت و رابط کاربری فارسی.
- Supabase: ورود کاربران، پایگاه داده، درخواست ساخت حساب و تأیید توسط مدیر.

GitHub Pages فقط فایل‌های HTML/CSS/JavaScript را میزبانی می‌کند و PHP یا پایگاه داده اجرا نمی‌کند.

---

## بخش A — آماده‌سازی GitHub Pages

1. مخزن GitHub را باز کن.
2. از مسیر Settings → Pages وارد تنظیمات انتشار شو.
3. در Build and deployment:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /(root)
4. روی Save بزن.
5. چند دقیقه بعد، آدرس سایت را در همان صفحه Pages ببین و باز کن.

نشانی دقیق Pages را از همان صفحه کپی کن؛ اگر نام مخزن را عوض کرده‌ای، مسیر URL هم مطابق نام جدید خواهد بود.

فایل‌های سایت:
- index.html: پوسته صفحه ورود
- app.js: ورود، پنل مدیر و عضو، ثبت درخواست، بررسی درخواست
- style.css: ظاهر واکنش‌گرای فارسی
- config.js: آدرس Supabase و کلید عمومی
- supabase/schema.sql: ساخت جدول‌ها و قوانین دسترسی
- supabase/functions/: سه تابع سمت سرور

## بخش B — ساخت پروژه Supabase

1. به https://database.new برو.
2. با حساب خودت وارد شو.
3. روی New project کلیک کن.
4. مقدارها:
   - Project name: sarbazan-imamzaman
   - Database password: رمز قوی و جداگانه
   - Region: نزدیک‌ترین منطقه‌ای که از شبکه تو قابل دسترسی و پایدار است
   - Plan: Free، اگر برای حسابت در دسترس است
5. روی Create new project بزن و آماده‌شدن پروژه را صبر کن.

رمز پایگاه داده را ذخیره کن، ولی آن را در GitHub، فایل‌های عمومی یا این گفتگو قرار نده.

## بخش C — ساخت پایگاه داده (حتی اگر قبلاً SQL قدیمی را اجرا کرده‌ای)

1. در داشبورد پروژه Supabase وارد SQL Editor شو.
2. روی New query کلیک کن.
3. در مخزن GitHub فایل supabase/schema.sql را باز کن:
   https://github.com/hoseinhoseinh3000-maker/-/blob/main/supabase/schema.sql
4. روی Raw کلیک کن، همه متن را کپی کن.
5. متن را در SQL Editor جای‌گذاری کن و Run را بزن.
6. اجرای دستورات باید بدون خطای قرمز تمام شود.

این نسخه علاوه بر پروفایل، پیام‌های خصوصی و اطلاعیه‌ها، جدول registration_requests را هم اضافه می‌کند. اگر قبلاً نسخه قدیمی SQL را اجرا کرده‌ای، حتماً همین نسخه جدید را نیز کامل اجرا کن؛ دستورات جدول‌ها و سیاست‌ها برای اجرای دوباره نوشته شده‌اند.

## بخش D — ساخت حساب مدیر اصلی

1. در Supabase از منوی چپ وارد Authentication → Users شو.
2. روی Add user و سپس Create new user بزن.
3. ایمیل خودت و یک رمز قوی را وارد کن و حساب را بساز.
4. ایمیل همان حساب را یادداشت کن.
5. به SQL Editor برگرد و دستور زیر را اجرا کن؛ ایمیل نمونه را با ایمیل واقعی خودت عوض کن:

    UPDATE public.profiles
    SET role = 'admin', is_active = true
    WHERE email = 'you@example.com';

6. برای اطمینان، این دستور را با ایمیل خودت اجرا کن:

    SELECT email, role, is_active
    FROM public.profiles
    WHERE email = 'you@example.com';

باید نقش admin و وضعیت true دیده شود. اگر هیچ ردیفی برنگشت، حساب را در Authentication > Users بررسی کن؛ تریگر پایگاه داده هنگام ساخت کاربر باید پروفایل را ایجاد کرده باشد.

7. از Authentication → Settings بخش ثبت‌نام کاربران را پیدا کن و ثبت‌نام مستقیم عمومی (Allow new users to sign up) را خاموش کن. درخواست حساب عمومی از فرم سایت ثبت می‌شود و فقط تابع امن پس از تأیید مدیر کاربر را می‌سازد.

## بخش E — اتصال کلید عمومی به سایت

1. در Supabase وارد Project Settings → API Keys شو.
2. مقدار Project URL را کپی کن.
3. مقدار Publishable key را کپی کن؛ معمولاً با sb_publishable_ شروع می‌شود.
4. در GitHub فایل config.js را باز کن:
   https://github.com/hoseinhoseinh3000-maker/-/blob/main/config.js
5. روی مداد Edit کلیک کن و متن را به شکل زیر قرار بده و دو مقدار واقعی را جایگزین کن:

    window.SARBAZAN_CONFIG = {
      supabaseUrl: "https://PROJECT-REF.supabase.co",
      supabaseAnonKey: "sb_publishable_YOUR_PUBLIC_KEY"
    };

6. روی Commit changes بزن.

کلید Publishable برای قرارگرفتن در مرورگر ساخته شده است؛ امنیت اطلاعات با Row Level Security اعمال می‌شود. کلید Secret یا Service Role را هرگز داخل config.js یا GitHub نگذار. کلیدهای Secret دسترسی مدیریتی دارند و سیاست‌های RLS را دور می‌زنند.

## بخش F — انتشار سه Edge Function از داخل داشبورد (بدون نصب برنامه)

این مرحله را با دقت انجام بده. توابع، عملیات امن سمت سرور را انجام می‌دهند؛ کلید محرمانه در آن‌ها باقی می‌ماند.

برای هر تابع:
1. در Supabase منوی Edge Functions را باز کن.
2. روی Deploy a new function بزن.
3. Via Editor را انتخاب کن.
4. نام تابع را دقیق وارد کن.
5. فایل مربوطه را در GitHub باز کن، Raw را بزن و تمام کد را کپی کن.
6. کد اولیه ویرایشگر را پاک کن و کد فایل را جای‌گذاری کن.
7. روی Deploy function کلیک کن.

### تابع اول: request-access

فایل کد:
https://github.com/hoseinhoseinh3000-maker/-/blob/main/supabase/functions/request-access/index.ts

- Function name: request-access
- پس از Deploy، تنظیم Verify JWT را فقط برای این تابع خاموش کن؛ چون کسی که هنوز حساب ندارد باید بتواند درخواست بفرستد.
- تابع ورودی‌ها را اعتبارسنجی می‌کند، فیلد پنهان ضدربات دارد و تعداد درخواست‌های هر IP را محدود می‌کند.
- این تابع فقط یک درخواست «در انتظار بررسی» ذخیره می‌کند؛ هیچ حسابی برای درخواست‌کننده نمی‌سازد.

### تابع دوم: review-registration

فایل کد:
https://github.com/hoseinhoseinh3000-maker/-/blob/main/supabase/functions/review-registration/index.ts

- Function name: review-registration
- Verify JWT باید روشن بماند.
- فقط مدیر واردشده می‌تواند آن را اجرا کند.
- با تأیید درخواست، حساب کاربر ساخته می‌شود و یک رمز موقت تصادفی به مدیر نمایش داده می‌شود.
- با رد درخواست، حسابی ساخته نمی‌شود.

### تابع سوم: create-member

فایل کد:
https://github.com/hoseinhoseinh3000-maker/-/blob/main/supabase/functions/create-member/index.ts

- Function name: create-member
- Verify JWT باید روشن بماند.
- برای زمانی است که مدیر بخواهد بدون درخواست قبلی، خودش حساب یک عضو را بسازد.

نکته Verify JWT: به‌طور پیش‌فرض Edge Functionها بررسی JWT را انجام می‌دهند. فقط endpoint عمومی request-access باید بدون JWT قابل فراخوانی باشد؛ کد آن به‌صورت مستقل ورودی‌ها و محدودیت تعداد درخواست را کنترل می‌کند. برای دو تابع مدیریتی این حفاظت را خاموش نکن.

فایل supabase/config.toml تنظیم درست هر تابع را نگه داشته است. اگر بعداً با CLI منتشر کنی، این تنظیمات خودکار اعمال می‌شوند؛ در انتشار از Dashboard باید Verify JWT را برای request-access از صفحه تنظیم تابع خاموش کنی.

## بخش G — تجربه درخواست حساب و تأیید مدیر

1. بازدیدکننده آدرس سایت را باز می‌کند.
2. روی درخواست ساخت حساب جدید می‌زند.
3. نام، ایمیل، شماره تماس اختیاری و علت درخواست را وارد می‌کند.
4. درخواست وارد جدول خصوصی می‌شود و فقط مدیر آن را می‌بیند.
5. مدیر وارد حساب خودش می‌شود و در بخش درخواست‌های حساب درخواست را بررسی می‌کند.
6. با زدن تأیید و ساخت حساب، تابع سمت سرور حساب Supabase Auth را می‌سازد.
7. رمز موقت فقط یک‌بار برای مدیر نشان داده می‌شود؛ آن را از راه امن به همان فرد تحویل بده.
8. با رد درخواست، حسابی ایجاد نمی‌شود.

پیش از تأیید، هویت درخواست‌دهنده و تعلق ایمیل به او را از راه مطمئن بررسی کن؛ فرم درخواست به‌تنهایی مالکیت ایمیل را اثبات نمی‌کند. ارسال خودکار ایمیل یا پیامک در این نسخه فعال نیست.

## بخش H — آزمایش نهایی

1. سایت GitHub Pages را با HTTPS باز کن.
2. روی درخواست ساخت حساب جدید بزن و یک درخواست آزمایشی با ایمیل آزمایشی ثبت کن.
3. با حساب مدیر وارد شو.
4. بخش درخواست‌های حساب را باز کن؛ درخواست باید در صف باشد.
5. تأیید کن و رمز موقت را یادداشت کن.
6. از حساب مدیر خارج شو.
7. با ایمیل و رمز موقت عضو وارد شو.
8. بررسی کن عضو فقط پنل خودش را می‌بیند.
9. دوباره با مدیر وارد شو، پنل همان عضو را باز کن و یک پیام خصوصی ثبت کن.
10. با حساب عضو دوباره وارد شو و نمایش همان پیام را بررسی کن.

## نکات امنیتی

- رمزها توسط Supabase Auth مدیریت می‌شوند و این پروژه رمز خام را در جدول عمومی ذخیره نمی‌کند.
- جدول‌های خصوصی با Row Level Security محافظت می‌شوند. هر عضو فقط سطرهای متعلق به شناسه خودش را می‌خواند.
- درخواست‌های ثبت‌نام فقط از طریق Edge Function سمت سرور ذخیره می‌شوند؛ کاربران ناشناس اجازه خواندن صف درخواست‌ها را ندارند.
- رمز موقت را فقط یک‌بار کپی کن و به صاحب حساب تحویل بده.
- کلید Secret را به هیچ‌کس نده. کلید Publishable برای مرورگر است، Secret فقط برای Edge Function.
- از پایگاه داده به‌طور منظم نسخه پشتیبان بگیر.
- این بسته هنوز بدون انجام مراحل داشبورد Supabase به سایت عملیاتی متصل نیست.

## پیوندهای رسمی راهنما
- Supabase Edge Functions در داشبورد: https://supabase.com/docs/guides/functions/quickstart-dashboard
- تنظیم Verify JWT: https://supabase.com/docs/guides/functions/function-configuration
- متغیرهای محیطی و API Keys: https://supabase.com/docs/guides/functions/secrets
- ساخت کاربر توسط مدیر: https://supabase.com/docs/reference/javascript/auth-admin-createuser
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages
