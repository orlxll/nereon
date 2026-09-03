# NEREON Phase 127 — Invoice Lead ID Reconciliation

Düzeltme: mevcut D1 üretim şemasında `invoices.lead_id` zorunlu olduğu için invoice INSERT'leri `lead_id` ile uyumlu hale getirildi. Stripe payment INSERT'ine de `lead_id` eklendi.

Yeni migration gerekmez; mevcut veri korunur.
