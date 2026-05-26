UPDATE campaign_reactivation 
SET whatsapp_d1_enviado = false, dia_sequencia = 0, updated_at = now()
WHERE segmento = 'morno' 
AND telefone IS NOT NULL 
AND telefone != '';