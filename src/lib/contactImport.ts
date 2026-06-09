/**
 * Contact Import Utilities
 * Parsing VCF/vCard, normalizing phones, detecting duplicates
 * 
 * SCOPE (MVP v1):
 * - Suporte: VCF e CSV apenas (sem Excel binário)
 * - Importa: apenas clientes (veículos são lidos mas NÃO criados automaticamente)
 * - Dedup: por telefone (últimos 9 dígitos) contra base existente + dentro do arquivo
 * - Ações: "criar" ou "ignorar" (sem atualizar/mesclar — será v2)
 */

export interface ImportedContact {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  cpf_cnpj?: string;
  endereco?: string;
  // Import metadata
  origem: string;
  valid: boolean;
  error?: string;
  // Dedup
  duplicateOf?: { id: string; nome: string; telefone?: string | null };
  internalDuplicate?: boolean; // duplicate within same file
  action?: "criar" | "ignorar";
}

// ─── Phone Normalization ───

export function normalizePhone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits || digits.replace(/\D/g, "").length < 8) return undefined;

  digits = digits.replace(/^\+/, "");

  // Brazilian DDI
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    digits = digits.slice(2);
  }

  if (digits.length < 10 || digits.length > 11) {
    return raw.replace(/[^\d+]/g, "") || undefined;
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function phoneDigitsOnly(phone: string | undefined | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

function phoneKey(phone: string | undefined | null): string | null {
  const digits = phoneDigitsOnly(phone);
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

// ─── VCF/vCard Parser ───

export function parseVCF(text: string): ImportedContact[] {
  const contacts: ImportedContact[] = [];
  const vcards = text.split("BEGIN:VCARD");

  for (const block of vcards) {
    if (!block.includes("END:VCARD")) continue;

    const lines = block.split(/\r?\n/);
    let nome = "";
    let telefone: string | undefined;
    let email: string | undefined;
    let endereco: string | undefined;
    let observacoes: string | undefined;

    for (const line of lines) {
      const upper = line.toUpperCase();

      if (upper.startsWith("FN:") || upper.startsWith("FN;")) {
        nome = extractValue(line);
      } else if (upper.startsWith("N:") || upper.startsWith("N;")) {
        if (!nome) {
          const parts = extractValue(line).split(";");
          const first = parts[1]?.trim() || "";
          const last = parts[0]?.trim() || "";
          nome = [first, last].filter(Boolean).join(" ");
        }
      } else if (upper.startsWith("TEL:") || upper.startsWith("TEL;")) {
        if (!telefone) telefone = extractValue(line);
      } else if (upper.startsWith("EMAIL:") || upper.startsWith("EMAIL;")) {
        if (!email) email = extractValue(line);
      } else if (upper.startsWith("ADR:") || upper.startsWith("ADR;")) {
        if (!endereco) {
          endereco = extractValue(line).split(";").filter(Boolean).join(", ");
        }
      } else if (upper.startsWith("NOTE:") || upper.startsWith("NOTE;")) {
        if (!observacoes) observacoes = extractValue(line);
      }
    }

    if (!nome.trim()) continue;

    const normalized = normalizePhone(telefone);
    const valid = nome.trim().length >= 2;

    contacts.push({
      id: crypto.randomUUID(),
      nome: nome.trim(),
      telefone: normalized || telefone?.trim(),
      email: email?.trim(),
      endereco: endereco?.trim(),
      observacoes: observacoes?.trim(),
      origem: "importacao_vcf",
      valid,
      error: !valid ? "Nome muito curto" : undefined,
      action: "criar",
    });
  }

  return contacts;
}

function extractValue(line: string): string {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return line;
  return line.slice(colonIndex + 1).trim();
}

// ─── CSV Parser ───

export function parseCSV(text: string): ImportedContact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(headerLine);
  const colMap = detectColumnMapping(headers);

  const contacts: ImportedContact[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);

    const nome = (values[colMap.nome] || "").trim();
    if (!nome) continue;

    const rawPhone = values[colMap.telefone] || undefined;
    const normalized = normalizePhone(rawPhone);

    contacts.push({
      id: crypto.randomUUID(),
      nome,
      telefone: normalized || rawPhone?.trim(),
      email: (values[colMap.email] || "").trim() || undefined,
      cpf_cnpj: (values[colMap.cpf_cnpj] || "").trim() || undefined,
      endereco: (values[colMap.endereco] || "").trim() || undefined,
      observacoes: (values[colMap.observacoes] || "").trim() || undefined,
      origem: "importacao_csv",
      valid: nome.length >= 2,
      error: nome.length < 2 ? "Nome muito curto" : undefined,
      action: "criar",
    });
  }

  return contacts;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function detectColumnMapping(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {
    nome: 0, telefone: 1, email: 2, cpf_cnpj: 3, endereco: 4, observacoes: 5,
  };

  const patterns: Record<string, RegExp> = {
    nome: /^(nome|name|cliente|razão|razao)/i,
    telefone: /^(telefone|phone|tel|celular|whatsapp|fone)/i,
    email: /^(email|e-mail|mail)/i,
    cpf_cnpj: /^(cpf|cnpj|cpf.cnpj|documento)/i,
    endereco: /^(endere[çc]o|address|rua|logradouro)/i,
    observacoes: /^(observa|nota|note|obs)/i,
  };

  headers.forEach((header, idx) => {
    const clean = header.replace(/['"]/g, "").trim();
    for (const [field, regex] of Object.entries(patterns)) {
      if (regex.test(clean)) {
        map[field] = idx;
        break;
      }
    }
  });

  return map;
}

// ─── Deduplication (against DB + intra-file) ───

interface ExistingClient {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
}

export function detectDuplicates(
  contacts: ImportedContact[],
  existingClients: ExistingClient[]
): ImportedContact[] {
  // 1. Build lookup from existing DB clients
  const dbPhoneMap = new Map<string, ExistingClient>();
  existingClients.forEach((c) => {
    const key = phoneKey(c.telefone);
    if (key) dbPhoneMap.set(key, c);
  });

  // 2. Track phones seen within the file itself
  const seenInFile = new Map<string, string>(); // phoneKey -> first contact id

  return contacts.map((contact) => {
    const key = phoneKey(contact.telefone);

    // Check against DB
    if (key) {
      const dbMatch = dbPhoneMap.get(key);
      if (dbMatch) {
        return {
          ...contact,
          duplicateOf: { id: dbMatch.id, nome: dbMatch.nome, telefone: dbMatch.telefone },
          action: "ignorar" as const,
        };
      }

      // Check against earlier contacts in same file
      const firstId = seenInFile.get(key);
      if (firstId) {
        return {
          ...contact,
          internalDuplicate: true,
          error: "Duplicado dentro do arquivo",
          action: "ignorar" as const,
        };
      }

      seenInFile.set(key, contact.id);
    }

    return contact;
  });
}

// ─── Template Download ───

export function downloadCSVTemplate() {
  const headers = "Nome,Telefone,Email,CPF/CNPJ,Endereço,Observações";
  const ex1 = "João Silva,(11) 99999-1234,joao@email.com,123.456.789-00,Rua das Flores 123,Cliente VIP";
  const ex2 = "Maria Santos,(11) 98888-5678,,,,Motoboy";
  const ex3 = "Pedro Oliveira,(11) 97777-9012,pedro@email.com,,,";

  const content = [headers, ex1, ex2, ex3].join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo_importacao_clientes.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Import Report ───

export interface ImportReport {
  loteId: string;
  dataHora: string;
  origem: "vcf" | "csv";
  totalArquivo: number;
  criados: number;
  ignorados: number;
  erros: number;
  duplicadosBase: number;
  duplicadosInternos: number;
}
