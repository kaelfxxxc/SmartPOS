export type Product = {
  id: string
  name: string
  sku: string | null
  price_centavos: number
  cost_centavos: number
  minimum_stock: number
  status: "active" | "archived"
  product_barcodes: Array<{ barcode: string; is_primary: boolean }>
  inventory_balances: Array<{ confirmed_quantity: number }>
}

export type BusinessContext = {
  businessId: string
  branchId: string
  businessName: string
  branchName: string
  role: string
}

export type WorkspaceView =
  | "dashboard"
  | "pos"
  | "products"
  | "inventory"
  | "sales"
  | "credit"
  | "people"
  | "settings"
  | "notifications"

export const peso = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(centavos / 100)
