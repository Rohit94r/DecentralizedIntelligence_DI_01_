/**
 * Razorpay Standard Checkout in the browser: load checkout.js once, open the
 * popup for an order our server created, and hand the result back to the
 * server — which checks the signature and asks Razorpay before unlocking
 * anything. The Key ID is public; the secret never reaches the browser.
 */
import { api, type RazorpayOptions } from "./api";

interface RazorpayInstance {
  open(): void;
  on(event: string, cb: (r: { error?: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay needs a browser."));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Razorpay — check your internet connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

export class PaymentCancelled extends Error {
  constructor() {
    super("Payment cancelled — nothing was charged.");
  }
}

/**
 * Opens Razorpay for the order, then verifies the payment on our server.
 * Resolves with the server's verdict ("succeeded", or "pending" while the bank
 * confirms); rejects with PaymentCancelled if the popup is closed.
 */
export async function payWithRazorpay(payment: string, o: RazorpayOptions, prefill?: { name?: string; email?: string; contact?: string }): Promise<string> {
  await loadRazorpay();
  const result = await new Promise<{ razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }>((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: o.key_id,
      order_id: o.order_id,
      amount: o.amount,
      currency: o.currency,
      name: o.name,
      description: o.description,
      notes: o.notes,
      image: `${window.location.origin}/brands/layerflow-256.png`,
      prefill: prefill ?? {},
      theme: { color: "#0a0a0a" },
      handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => resolve(r),
      modal: { ondismiss: () => reject(new PaymentCancelled()) },
    });
    // a failed attempt keeps the popup open so the payer can try another method
    rz.on("payment.failed", () => {});
    rz.open();
  });
  const v = await api.verifyRazorpay({ payment, ...result });
  return v.status;
}
