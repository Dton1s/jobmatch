import { Smartphone } from "lucide-react";

export function NativePurchaseNotice({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`native-purchase-notice${compact ? " compact" : ""}`} role="status">
      <Smartphone size={compact ? 14 : 17} aria-hidden="true" />
      <span>
        <b>Compra desde la app</b>
        <small>Google Play Billing todavía no está conectado. Stripe no se abrirá desde aquí.</small>
      </span>
    </aside>
  );
}
