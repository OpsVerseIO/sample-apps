import { NextResponse, type NextRequest } from "next/server";
import { resolveCartId } from "@/lib/cart-cookie";
import { chargeCard, PaymentDeclinedError } from "@/lib/payments";
import { clearCart, getCart, MAX_QTY_IN_STOCK, saveOrder, type ShippingDetails } from "@/lib/store";

interface CheckoutRequest {
  shipping: ShippingDetails;
  cardNumber: string;
}

export async function POST(request: NextRequest) {
  const { cartId } = resolveCartId(request);
  const { shipping, cardNumber }: CheckoutRequest = await request.json();

  if (!shipping?.name || !shipping?.email || !shipping?.address) {
    return NextResponse.json({ error: "missing_shipping_details" }, { status: 400 });
  }

  const cart = getCart(cartId);
  if (cart.items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }

  const outOfStock = cart.items.find((i) => i.quantity > MAX_QTY_IN_STOCK);
  if (outOfStock) {
    return NextResponse.json(
      { error: "out_of_stock", productId: outOfStock.productId },
      { status: 409 },
    );
  }

  try {
    await chargeCard(cardNumber, cart.total);
  } catch (err) {
    if (err instanceof PaymentDeclinedError) {
      return NextResponse.json({ error: "payment_declined", reason: err.message }, { status: 402 });
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

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
