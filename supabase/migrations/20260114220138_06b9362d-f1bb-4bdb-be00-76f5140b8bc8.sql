-- Add explicit anonymous blocking to veiculos table
-- Drop existing SELECT policy and recreate with explicit auth check
DROP POLICY IF EXISTS "Usuários podem ver veículos de suas oficinas" ON veiculos;

CREATE POLICY "Usuários autenticados podem ver veículos de suas oficinas"
ON veiculos
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Add explicit anonymous blocking to estoque table
DROP POLICY IF EXISTS "Usuários podem ver estoque de suas oficinas" ON estoque;

CREATE POLICY "Usuários autenticados podem ver estoque de suas oficinas"
ON estoque
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Also update INSERT/UPDATE/DELETE policies to use TO authenticated
-- Veiculos INSERT
DROP POLICY IF EXISTS "Usuários podem criar veículos em suas oficinas" ON veiculos;
CREATE POLICY "Usuários autenticados podem criar veículos em suas oficinas"
ON veiculos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Veiculos UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar veículos de suas oficinas" ON veiculos;
CREATE POLICY "Usuários autenticados podem atualizar veículos de suas oficinas"
ON veiculos
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Veiculos DELETE
DROP POLICY IF EXISTS "Usuários podem deletar veículos de suas oficinas" ON veiculos;
CREATE POLICY "Usuários autenticados podem deletar veículos de suas oficinas"
ON veiculos
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Estoque INSERT
DROP POLICY IF EXISTS "Usuários podem criar itens de estoque em suas oficinas" ON estoque;
CREATE POLICY "Usuários autenticados podem criar itens de estoque em suas oficinas"
ON estoque
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Estoque UPDATE
DROP POLICY IF EXISTS "Usuários podem atualizar estoque de suas oficinas" ON estoque;
CREATE POLICY "Usuários autenticados podem atualizar estoque de suas oficinas"
ON estoque
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);

-- Estoque DELETE
DROP POLICY IF EXISTS "Usuários podem deletar itens de estoque de suas oficinas" ON estoque;
CREATE POLICY "Usuários autenticados podem deletar itens de estoque de suas oficinas"
ON estoque
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND oficina_id IN (
    SELECT id FROM oficinas WHERE user_id = auth.uid()
  )
);