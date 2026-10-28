"use client";

import { useState } from "react";
import { trackJourneyStep } from "@/lib/journey";
import { useCart } from "./CartProvider";

export function AddToCartButton({ productId }: { productId: string }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  async function handleAdd() {
    setStatus("adding");
    try {
      await addItem(productId, quantity);
      setStatus("added");
      trackJourneyStep("add_to_cart", "success", { product_id: productId, quantity });
    } catch {
      setStatus("error");
      trackJourneyStep("add_to_cart", "failure", { product_id: productId, error_reason: "cart_api_error" });
    }
  }

  return (
    <div className="add-to-cart">
      <label>
        Qty
        <input
          type="number"
          min={1}
          max={10}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />
      </label>
      <button className="btn primary" onClick={handleAdd} disabled={status === "adding"}>
        {status === "adding" ? "Adding…" : "Add to cart"}
      </button>
      {status === "added" && <span className="ok">Added to cart ✓</span>}
      {status === "error" && <span className="err">Could not add to cart</span>}
    </div>
  );
}
