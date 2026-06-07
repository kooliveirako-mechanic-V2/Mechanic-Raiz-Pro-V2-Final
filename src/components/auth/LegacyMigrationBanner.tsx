import { motion } from "framer-motion";
import { Database } from "lucide-react";

/**
 * Aviso fixo em /auth orientando clientes da base legada a usarem o
 * mesmo e-mail antigo. Não faz lookup, não expõe dados antes do login.
 */
export function LegacyMigrationBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-xl border border-blue-200 bg-blue-50/80 p-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
          <Database className="w-3.5 h-3.5 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-900 leading-snug">
            Já usava o sistema antigo? Use o <strong>mesmo e-mail de antes</strong>.
          </p>
          <p className="text-xs text-blue-800 mt-0.5 leading-snug">
            Se sua senha antiga não funcionar, clique em <strong>Criar conta</strong> ou entre com <strong>Google</strong> usando esse mesmo e-mail. Seus dados serão recuperados automaticamente.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
