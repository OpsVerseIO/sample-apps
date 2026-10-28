import { defineJourney } from "@/observability/journey";

export const checkoutJourney = defineJourney("checkout", [
  "browse",
  "view_product",
  "add_to_cart",
  "view_cart",
  "begin_checkout",
  "place_order",
  "order_confirmed",
]);
