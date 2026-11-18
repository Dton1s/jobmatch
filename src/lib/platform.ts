import { Capacitor } from "@capacitor/core";

export type PaymentChannel = "stripe" | "google_play";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPaymentChannel(): PaymentChannel {
  return isNativePlatform() ? "google_play" : "stripe";
}

export const NATIVE_BILLING_UNAVAILABLE_MESSAGE =
  "Las compras desde la app aún no están disponibles. Google Play Billing no está conectado y no se abrirá Stripe.";
