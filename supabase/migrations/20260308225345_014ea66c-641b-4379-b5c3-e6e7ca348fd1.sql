INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing', 'marketing', true)
ON CONFLICT (id) DO NOTHING;