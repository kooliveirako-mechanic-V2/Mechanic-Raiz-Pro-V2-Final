CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'marketing');
