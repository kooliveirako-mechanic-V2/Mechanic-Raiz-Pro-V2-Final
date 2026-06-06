CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'marketing');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'marketing');