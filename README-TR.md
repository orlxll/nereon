# NEREON V8 — Cloudflare Pages + D1

Bu paket NEREON sitesini Cloudflare Pages üzerinde yayınlamak ve Automation Planner lead'lerini Cloudflare D1 veritabanına kaydetmek için hazırlanmıştır.

## Neden Cloudflare?
Cloudflare Workers Free planında günlük 100.000 Worker isteği bulunur. D1 ücretsiz planda günlük 5 milyon satır okuma, 100.000 satır yazma ve 5 GB depolama içerir. 1 Eylül 2026'dan beri ücretsiz D1 günlük okuma/yazma limitleri aşılırsa sorgular gün sonuna kadar durur; veriler silinmez.

## Kurulum — tarayıcı ile
1. https://dash.cloudflare.com/ adresinden Cloudflare hesabı aç.
2. Workers & Pages -> Create application -> Pages -> Connect to Git seç.
3. GitHub'daki `orIxll/nereon` repository'sini bağla.
4. Build command boş bırakılabilir. Build output directory için `.` kullan.
5. Deploy et.
6. Workers & Pages -> D1 SQL Database bölümünden `nereon-leads` adlı D1 database oluştur.
7. Pages projesi -> Settings -> Bindings -> Add -> D1 database.
8. Variable name: `DB`. Database: `nereon-leads`.
9. Tekrar Deploy et.
10. D1 SQL bölümünde `migrations/0001_initial.sql` içeriğini çalıştır veya Wrangler migration kullan.

## Yerel CLI seçeneği
Node.js ve Wrangler kuruluysa:
- `npx wrangler login`
- `npx wrangler d1 create nereon-leads`
- Çıkan database_id'yi `wrangler.toml` içine yaz.
- `npx wrangler d1 migrations apply nereon-leads --remote`

## Test
- `GET /api/health` database binding durumunu gösterir.
- `POST /api/public/automation-plan` lead + plan kaydeder.

## Gizlilik
Planner'a gereksiz hassas veri girmeyin. Bu ilk sürüm yalnızca isim, iş e-postası, şirket, workflow ve blueprint gibi satış keşif verilerini saklamak için tasarlanmıştır. Gerçek prod ortamında gizlilik metni, veri saklama süresi ve silme talebi akışı ayrıca eklenmelidir.
