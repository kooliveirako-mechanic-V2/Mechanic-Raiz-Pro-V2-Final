/**
 * NÍVEL 5 — Guardas de Runtime contra Regressões
 * 
 * Validações pré-mutação que impedem dados inválidos de chegarem ao banco.
 * Cada guard lança erro descritivo que é capturado pelo humanizeError().
 * 
 * REGRA: Toda mutação crítica DEVE passar por seu guard antes do insert/update.
 */

// ============================================================
// OS (Ordem de Serviço)
// ============================================================

export interface OSGuardInput {
  cliente_id: string;
  veiculo_id: string;
  tipo_servico: string;
  oficina_id: string;
}

export function guardCreateOS(input: OSGuardInput): void {
  if (!input.oficina_id?.trim()) {
    throw new Error("[Guard] oficina_id ausente ao criar OS — sessão inválida");
  }
  if (!input.cliente_id?.trim()) {
    throw new Error("[Guard] cliente_id ausente — selecione um cliente");
  }
  if (!input.veiculo_id?.trim()) {
    throw new Error("[Guard] veiculo_id ausente — selecione um veículo");
  }
  if (!input.tipo_servico?.trim()) {
    throw new Error("[Guard] tipo_servico ausente — selecione o tipo de serviço");
  }
}

// ============================================================
// Itens de OS
// ============================================================

export interface ItemOSGuardInput {
  ordem_servico_id: string;
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
}

export function guardAddItemOS(input: ItemOSGuardInput): void {
  if (!input.ordem_servico_id?.trim()) {
    throw new Error("[Guard] ordem_servico_id ausente ao adicionar item");
  }
  if (!input.nome_item?.trim()) {
    throw new Error("[Guard] nome_item vazio — informe a descrição do item");
  }
  if (typeof input.quantidade !== "number" || input.quantidade <= 0) {
    throw new Error("[Guard] quantidade inválida — deve ser maior que zero");
  }
  if (typeof input.valor_unitario !== "number" || input.valor_unitario < 0) {
    throw new Error("[Guard] valor_unitario inválido — não pode ser negativo");
  }
}

// ============================================================
// Financeiro
// ============================================================

export interface FinanceiroGuardInput {
  oficina_id: string;
  tipo: string;
  origem: string;
  valor: number;
}

export function guardCreateFinanceiro(input: FinanceiroGuardInput): void {
  if (!input.oficina_id?.trim()) {
    throw new Error("[Guard] oficina_id ausente no lançamento financeiro");
  }
  if (!["entrada", "saida"].includes(input.tipo)) {
    throw new Error(`[Guard] tipo financeiro inválido: "${input.tipo}"`);
  }
  if (!input.origem?.trim()) {
    throw new Error("[Guard] origem ausente no lançamento financeiro");
  }
  if (typeof input.valor !== "number" || input.valor <= 0) {
    throw new Error("[Guard] valor deve ser maior que zero");
  }
}

// ============================================================
// Estoque
// ============================================================

export interface EstoqueGuardInput {
  oficina_id: string;
  nome: string;
  categoria: string;
}

export function guardCreateEstoque(input: EstoqueGuardInput): void {
  if (!input.oficina_id?.trim()) {
    throw new Error("[Guard] oficina_id ausente ao criar item de estoque");
  }
  if (!input.nome?.trim()) {
    throw new Error("[Guard] nome do produto ausente");
  }
  if (!input.categoria?.trim()) {
    throw new Error("[Guard] categoria ausente");
  }
}

// ============================================================
// Cliente
// ============================================================

export interface ClienteGuardInput {
  oficina_id: string;
  nome: string;
}

export function guardCreateCliente(input: ClienteGuardInput): void {
  if (!input.oficina_id?.trim()) {
    throw new Error("[Guard] oficina_id ausente ao criar cliente");
  }
  if (!input.nome?.trim()) {
    throw new Error("[Guard] nome do cliente ausente");
  }
}

// ============================================================
// Veículo
// ============================================================

export interface VeiculoGuardInput {
  oficina_id: string;
  cliente_id: string;
  marca: string;
  modelo: string;
  tipo: string;
}

export function guardCreateVeiculo(input: VeiculoGuardInput): void {
  if (!input.oficina_id?.trim()) {
    throw new Error("[Guard] oficina_id ausente ao criar veículo");
  }
  if (!input.cliente_id?.trim()) {
    throw new Error("[Guard] cliente_id ausente — vincule a um cliente");
  }
  if (!input.marca?.trim()) {
    throw new Error("[Guard] marca ausente");
  }
  if (!input.modelo?.trim()) {
    throw new Error("[Guard] modelo ausente");
  }
  if (!input.tipo?.trim()) {
    throw new Error("[Guard] tipo de veículo ausente");
  }
}

// ============================================================
// Guard genérico: oficina_id obrigatório
// ============================================================

export function guardOficina(oficina_id: string | undefined | null, context: string): asserts oficina_id is string {
  if (!oficina_id?.trim()) {
    throw new Error(`[Guard] Nenhuma oficina selecionada (${context})`);
  }
}
