# Admin API Capabilities — @supabase/supabase-js
**Data:** 2026-07-18  
**SDK instalada:** `@supabase/supabase-js@2.110.0` (`@supabase/auth-js` incluída)

---

## supabase.auth.admin.createUser — suporte a `id` explícito

**Resultado: NÃO suportado pelo SDK JS nesta versão.**

O tipo `AdminUserAttributes` (interface usada pelo `createUser`) estende `UserAttributes` e não inclui o campo `id`:

```typescript
export interface AdminUserAttributes extends Omit<UserAttributes, 'data'> {
  user_metadata?: object;
  app_metadata?: object;
  email_confirm?: boolean;
  phone_confirm?: boolean;
  ban_duration?: string | 'none';
  role?: string;
  password?: string;
  // id: NÃO está presente
}
```

**Alternativa disponível:** A Admin REST API do Supabase aceita `id` no body:

```bash
POST https://<project>.supabase.co/auth/v1/admin/users
Authorization: Bearer <service_role_key>
Content-Type: application/json

{
  "id": "uuid-explícito",
  "email": "user@example.com",
  "email_confirm": true
}
```

Isso NÃO usa o SDK JS — requer `fetch` direto com a service_role_key.

**Implicação para o piloto:**
- Para preservar UUID do usuário existente: chamar REST API diretamente
- Para criar usuário sem UUID específico: pode usar `admin.createUser()` normalmente
- Para o piloto descartável (UUID aleatório): `admin.createUser()` funciona

---

## supabase.auth.admin.updateUserById — cria identity?

**Resultado: INDETERMINADO — requer teste no piloto.**

A documentação oficial não garante criação de identity via `updateUserById`. O SDK aceita o campo `email` mas o comportamento de criação de identity não está documentado explicitamente.

**Não aplicar nos 35 usuários reais sem prova no piloto.**

---

## supabase.auth.admin.generateLink — funciona conforme esperado

```typescript
const { data } = await supabase.auth.admin.generateLink({
  type: 'recovery',
  email: 'user@example.com',
  options: { redirectTo: 'https://www.mechanicraizpro.com.br/reset-password' }
})
```

Retorna `data.properties.action_link` — não enviar via Resend nesta fase.

---

## Resumo para o piloto

| Operação | Via SDK JS | Via REST API |
|----------|-----------|-------------|
| createUser sem UUID específico | ✅ `admin.createUser()` | ✅ |
| createUser com UUID específico | ❌ tipo não aceita `id` | ✅ POST /auth/v1/admin/users |
| updateUserById | ✅ | ✅ |
| generateLink (recovery) | ✅ | ✅ |
| Criar identity manualmente | ❌ não suportado | ❌ não documentado |

**Recomendação:** Para preservar UUIDs dos 35 usuários existentes no futuro, usar REST API direta (`fetch` com service_role_key). Para o piloto descartável, usar `admin.createUser()` normalmente.
