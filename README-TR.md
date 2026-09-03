# NEREON — Phase 116 / Sales Pipeline

Bu sürüm admin panelini sadece görüntüleme ekranından satış operasyon paneline yükseltir.

## Yeni özellikler
- Lead pipeline: New → Contacted → Replied → Discovery → Proposal → Won/Lost
- Pipeline sayaçları ve filtreleme
- Lead notları
- Next action tarihi
- Mark contacted aksiyonu
- Status güncelleme
- Admin API PATCH endpoint

## D1 migration
`migrations/0002_sales_pipeline.sql` dosyası `leads` tablosuna şu alanları ekler:
- status
- notes
- next_action_at
- last_contacted_at

Migration bir kez Cloudflare D1'de çalıştırılmalıdır.
