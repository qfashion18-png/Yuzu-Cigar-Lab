import {
  getCatalogProductBySkuOrId,
  getStorefrontProductBySlug,
  type CatalogProduct,
} from "@/lib/catalog";
import { resolveVisibleProductPrice } from "@/lib/catalog-pricing";
import type { ShoppingCart, ShoppingCartItem } from "@/lib/shopping-cart";

export function repriceCartForAccount(cart: ShoppingCart, isMember: boolean, now = Date.now()): ShoppingCart {
  if (!cart.items.length) {
    return cart;
  }

  let changed = false;
  const items = cart.items.map((item) => {
    const product = findCurrentCartProduct(item);

    if (!product) {
      return item;
    }

    const nextItem = reconcileCartItem(item, product, isMember);

    if (nextItem !== item) {
      changed = true;
    }

    return nextItem;
  });

  if (!changed) {
    return cart;
  }

  return {
    ...cart,
    items,
    updatedAt: Math.max(now, cart.updatedAt + 1),
  };
}

function reconcileCartItem(item: ShoppingCartItem, product: CatalogProduct, isMember: boolean): ShoppingCartItem {
  const unitPrice = resolveVisibleProductPrice(product, isMember);
  const maxQuantity = getCartStockLimit(product);
  const quantity = Math.min(item.quantity, maxQuantity);
  const nextItem = {
    ...item,
    productId: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    image: product.image,
    imagePosition: product.imagePosition,
    packageLabel: product.packageLabel,
    category: product.category,
    memberOnly: product.memberOnly,
    unitPrice,
    maxQuantity,
    quantity,
  };

  return hasCartItemChanged(item, nextItem) ? nextItem : item;
}

function findCurrentCartProduct(item: ShoppingCartItem) {
  return (
    getStorefrontProductBySlug(item.slug) ??
    getCatalogProductBySkuOrId(item.sku) ??
    getCatalogProductBySkuOrId(item.productId)
  );
}

function getCartStockLimit(product: CatalogProduct) {
  return product.availability === "Low stock" || product.status === "Low stock" ? 3 : 12;
}

function hasCartItemChanged(current: ShoppingCartItem, next: ShoppingCartItem) {
  return (
    current.productId !== next.productId ||
    current.slug !== next.slug ||
    current.name !== next.name ||
    current.sku !== next.sku ||
    current.image !== next.image ||
    current.imagePosition !== next.imagePosition ||
    current.packageLabel !== next.packageLabel ||
    current.category !== next.category ||
    current.memberOnly !== next.memberOnly ||
    current.unitPrice !== next.unitPrice ||
    current.maxQuantity !== next.maxQuantity ||
    current.quantity !== next.quantity
  );
}
