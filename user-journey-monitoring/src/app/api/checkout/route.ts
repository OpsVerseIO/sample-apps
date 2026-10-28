import { trace } from "@opentelemetry/api";
import { NextResponse, type NextRequest } from "next/server";
import { resolveCartId } from "@/lib/cart-cookie";
import { chargeCard, PaymentDeclinedError } from "@/lib/payments";
import { clearCart, getCart, MAX_QTY_IN_STOCK, saveOrder, type ShippingDetails } from "@/lib/store";
import { checkoutAttempts, orderValue, paymentDuration, withSpan } from "@/lib/telemetry";

interface CheckoutRequest {
  shipping: ShippingDetails;
  cardNumber: string;
}

// Records the attempt on both the metrics and the active (route) span so the
// outcome is queryable from Prometheus and from traces.
function fail(error: string, status: number, extra: Record<string, string> = {}) {
  checkoutAttempts.add(1, { outcome: "failure", "error.reason": extra.reason ?? error });
  trace.getActiveSpan()?.setAttributes({
    "checkout.outcome": "failure",
    "checkout.error": error,
    ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [`checkout.${k}`, v])),
  });
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(request: NextRequest) {
  const { cartId } = resolveCartId(request);
  const { shipping, cardNumber }: CheckoutRequest = await request.json();

  const cart = getCart(cartId);
  trace.getActiveSpan()?.setAttributes({
    "cart.id": cartId,
    "cart.item_count": cart.itemCount,
    "cart.value_usd": cart.total / 100,
  });

  const invalid = await withSpan("checkout.validate", { "cart.item_count": cart.itemCount }, async (span) => {
    if (!shipping?.name || !shipping?.email || !shipping?.address) return { error: "missing_shipping_details" };
    if (cart.items.length === 0) return { error: "empty_cart" };
    const outOfStock = cart.items.find((i) => i.quantity > MAX_QTY_IN_STOCK);
    if (outOfStock) {
      span.setAttribute("product.id", outOfStock.productId);
      return { error: "out_of_stock", productId: outOfStock.productId };
    }
    return null;
  });
  if (invalid?.productId) return fail(invalid.error, 409, { productId: invalid.productId });
  if (invalid) return fail(invalid.error, 400);

  const paymentStart = performance.now();
  try {
    await withSpan("payment.charge", { "payment.amount_usd": cart.total / 100 }, async (span) => {
      const { transactionId } = await chargeCard(cardNumber, cart.total);
      span.setAttribute("payment.transaction_id", transactionId);
    });
    paymentDuration.record((performance.now() - paymentStart) / 1000, { outcome: "success" });
  } catch (err) {
    paymentDuration.record((performance.now() - paymentStart) / 1000, { outcome: "failure" });
    if (err instanceof PaymentDeclinedError) {
      return fail("payment_declined", 402, { reason: err.message });
    }
    throw err;
  }

  const order = {
    id: `ord_${crypto.randomUUID().slice(0, 8)}`,
    items: cart.items,
    total: cart.total,
    shipping,
    cardLast4: cardNumber.replace(/\D/g, "").slice(-4),
    createdAt: new Date().toISOString(),
  };
  saveOrder(order);
  clearCart(cartId);

  checkoutAttempts.add(1, { outcome: "success", "error.reason": "none" });
  orderValue.record(order.total / 100);
  trace.getActiveSpan()?.setAttributes({ "checkout.outcome": "success", "order.id": order.id });

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
