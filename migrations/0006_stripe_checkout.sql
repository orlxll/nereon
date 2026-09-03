ALTER TABLE payments ADD COLUMN checkout_url TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id);
