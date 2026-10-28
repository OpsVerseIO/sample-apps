import { NextResponse, type NextRequest } from "next/server";
import { resolveCartId } from "@/lib/cart-cookie";
import { chargeCard, PaymentDeclinedError } from "@/lib/payments";
import { checkoutAttempts, orderValue, paymentDuration } from "@/lib/shop-metrics";
import { clearCart, getCart, MAX_QTY_IN_STOCK, saveOrder, type CartView, type ShippingDetails } from "@/lib/store";
import { annotate, recordOutcome, withSpan } from "@/observability/tracing";

interface CheckoutRequest {
  shipping: ShippingDetails;
  cardNumber: string;
}

interface CheckoutError {
  status: number;
  error: string;
  details?: Record<string, string>;
}

function validateCheckout(shipping: ShippingDetails | undefined, cart: CartView): CheckoutError | null {
  if (!shipping?.name || !shipping?.email || !shipping?.address) {
    return { status: 400, error: "missing_shipping_details" };
  }
  if (cart.items.length === 0) return { status: 400, error: "empty_cart" };
  const outOfStock = cart.items.find((i) => i.quantity > MAX_QTY_IN_STOCK);
  if (outOfStock) return { status: 409, error: "out_of_stock", details: { productId: outOfStock.productId } };
  return null;
}

function fail({ status, error, details = {} }: CheckoutError) {
  recordOutcome("checkout", "failure", { reason: details.reason ?? error, counter: checkoutAttempts });
  return NextResponse.json({ error, ...details }, { status });
}

export async function POST(request: NextRequest) {
  const { cartId } = resolveCartId(request);
  const { shipping, cardNumber }: CheckoutRequest = await request.json();
  const cart = getCart(cartId);
  annotate({ "cart.id": cartId, "cart.item_count": cart.itemCount, "cart.value_usd": cart.total / 100 });

  const invalid = await withSpan("checkout.validate", {}, async () => validateCheckout(shipping, cart));
  if (invalid) return fail(invalid);

  try {
    await withSpan(
      "payment.charge",
      { "payment.amount_usd": cart.total / 100 },
      async () => annotate({ "payment.transaction_id": (await chargeCard(cardNumber, cart.total)).transactionId }),
      { duration: paymentDuration },
    );
  } catch (err) {
    if (err instanceof PaymentDeclinedError) {
      return fail({ status: 402, error: "payment_declined", details: { reason: err.message } });
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

  recordOutcome("checkout", "success", { counter: checkoutAttempts, attributes: { "order.id": order.id } });
  orderValue.record(order.total / 100);

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
