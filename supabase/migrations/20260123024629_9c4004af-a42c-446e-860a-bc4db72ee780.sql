-- Create storage bucket for workshop logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('oficina-logos', 'oficina-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for oficina logos
CREATE POLICY "Users can view workshop logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'oficina-logos');

CREATE POLICY "Users can upload their workshop logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'oficina-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their workshop logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'oficina-logos' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their workshop logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'oficina-logos' 
  AND auth.uid() IS NOT NULL
);

-- Add logo_url column to oficinas table if it doesn't exist
ALTER TABLE public.oficinas ADD COLUMN IF NOT EXISTS logo_url TEXT;