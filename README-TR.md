# NEREON — Phase 120 / Contract + Payment Foundation

Teklif kabulü sonrası sözleşme ve fatura kayıtlarının oluşması için temel altyapı eklendi.

## Yeni özellikler
- `contracts` tablosu
- `invoices` tablosu
- `payments` tablosu
- Admin: `POST /api/admin/contracts`
- Admin: `GET /api/admin/contracts`
- Client proposal kabulünde idempotent contract + invoice oluşturma
- Client portalda kabul sonrası sonraki adımların açık gösterimi

## Önemli
Bu faz gerçek kart bilgisi toplamaz ve ödeme sağlayıcısı gibi davranmaz. `payments` tablosu ve invoice modeli gerçek Stripe/provider entegrasyonuna hazır temel sağlar. Gerçek ödeme provider bağlantısı ayrı bir fazda yapılmalıdır.

## D1 migration
`migrations/0005_contracts_payments.sql` dosyasını Cloudflare D1 Console'da bir kez çalıştırın.
