# NEREON Phase 121 — Stripe Ödeme

Bu sürüm, kabul edilmiş tekliften sonra müşterinin güvenli Stripe Checkout ekranına geçmesini sağlar.

## Cloudflare Secret'ları

Cloudflare → NEREON → Settings → Variables and Secrets bölümüne:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

eklenir. Gerçek Stripe anahtarları GitHub'a konulmaz.

## D1

`migrations/0006_stripe_checkout.sql` dosyasını D1 Console'da çalıştır.

## Akış

Teklif kabul edilir → Contract/Invoice oluşur → müşteri **Pay invoice** seçer → Stripe Checkout → Stripe webhook → payment/invoice/contract durumu güncellenir.

Stripe webhook endpoint'leri HTTPS üzerinden erişilebilir olmalı ve `Stripe-Signature` doğrulaması yapılmalıdır. Handler ham request body üzerinden imza doğrulaması yapar. citeturn285300view0

## Not

Şu aşamada Stripe hesabında gerçek ödeme almak için gerekli gerçek anahtarları veya webhook secret'ını eklemiyoruz. Önce test/sandbox modunda doğrulama yapacağız. Stripe Checkout Session oluşturma API'si ile ödeme oturumu yaratılıyor. citeturn285300view1
