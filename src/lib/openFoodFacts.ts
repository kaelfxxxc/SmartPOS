type OpenFoodFactsResponse = {
  status?: number
  product?: {
    brands?: string
    product_name?: string
    product_name_en?: string
    quantity?: string
  }
}

export type OpenFoodFactsProduct = {
  name: string
}

const GTIN_PATTERN = /^\d{8}$|^\d{12,14}$/

function appendDistinct(parts: string[], value?: string) {
  const normalized = value?.trim()
  if (!normalized) return
  const combined = parts.join(" ").toLocaleLowerCase()
  const candidate = normalized.toLocaleLowerCase()
  if (combined.includes(candidate)) return
  if (combined && candidate.includes(combined)) {
    parts.splice(0, parts.length, normalized)
    return
  }
  parts.push(normalized)
}

export async function lookupOpenFoodFactsProduct(
  barcode: string,
): Promise<OpenFoodFactsProduct | null> {
  const normalized = barcode.trim()
  if (!GTIN_PATTERN.test(normalized)) return null

  const url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json`,
  )
  url.searchParams.set(
    "fields",
    "brands,product_name,product_name_en,quantity",
  )

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error("Open Food Facts lookup failed")

  const data = (await response.json()) as OpenFoodFactsResponse
  if (data.status !== 1 || !data.product) return null

  const parts: string[] = []
  appendDistinct(parts, data.product.brands?.split(",")[0])
  appendDistinct(parts, data.product.product_name || data.product.product_name_en)
  appendDistinct(parts, data.product.quantity)

  return parts.length ? { name: parts.join(" ") } : null
}
