import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Archive,
  Bell,
  CheckCircle2,
  CreditCard,
  Download,
  Minus,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { Button, Field, SelectField } from "@/components/ui"
import { lookupOpenFoodFactsProduct } from "@/lib/openFoodFacts"
import { supabase } from "@/lib/supabase/client"
import BarcodeScanner from "@/features/barcode/BarcodeScanner"
import ReceiptDialog from "@/features/receipts/ReceiptDialog"
import { peso, type BusinessContext, type Product } from "./types"

function parseCentavos(value: string) {
  const normalized = value.trim().replace(/,/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ""] = normalized.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"))
}

function useProducts(context: BusinessContext, search = "") {
  return useQuery({
    queryKey: ["products", context.businessId, context.branchId, search],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id,name,sku,unit,image_path,price_centavos,cost_centavos,minimum_stock,status,product_barcodes(barcode,is_primary),inventory_balances(confirmed_quantity,branch_id)",
        )
        .eq("business_id", context.businessId)
        .eq("status", "active")
        .eq("inventory_balances.branch_id", context.branchId)
        .order("name")
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Product[]
    },
  })
}

function Empty({
  icon: Icon,
  title,
  copy,
  action,
}: {
  icon: typeof Package
  title: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <div className="workspace-empty">
      <span>
        <Icon />
      </span>
      <h2>{title}</h2>
      <p>{copy}</p>
      {action}
    </div>
  )
}

export function DashboardView({
  context,
  onNavigate,
}: {
  context: BusinessContext
  onNavigate: (view: "inventory" | "pos") => void
}) {
  const products = useProducts(context)
  const sales = useQuery({
    queryKey: ["dashboard-sales", context.branchId],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from("sales")
        .select("id,total_centavos,item_count,completed_at")
        .eq("branch_id", context.branchId)
        .eq("status", "completed")
        .gte("completed_at", today.toISOString())
      if (error) throw error
      return data ?? []
    },
  })
  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-sales-${context.branchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `branch_id=eq.${context.branchId}`,
        },
        () => {
          void sales.refetch()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [context.branchId, sales.refetch])
  const totals = useMemo(
    () =>
      (sales.data ?? []).reduce(
        (sum, sale) => ({
          total: sum.total + sale.total_centavos,
          items: sum.items + Number(sale.item_count),
        }),
        { total: 0, items: 0 },
      ),
    [sales.data],
  )
  const lowStock = (products.data ?? []).filter(
    (product) =>
      Number(product.inventory_balances[0]?.confirmed_quantity ?? 0) <= 5,
  ).length
  const hourlySales = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, index) => ({
      label: `${String(index * 2).padStart(2, "0")}:00`,
      total: 0,
      transactions: 0,
    }))
    const hourFormatter = new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Manila",
    })
    for (const sale of sales.data ?? []) {
      const hour = Number(hourFormatter.format(new Date(sale.completed_at)))
      const bucket = buckets[Math.min(11, Math.floor(hour / 2))]
      bucket.total += Number(sale.total_centavos)
      bucket.transactions += 1
    }
    return buckets
  }, [sales.data])
  const chartMaximum = Math.max(...hourlySales.map((bucket) => bucket.total), 1)
  const chartPoints = hourlySales
    .map((bucket, index) => {
      const x = (index / (hourlySales.length - 1)) * 100
      const y = 88 - (bucket.total / chartMaximum) * 72
      return `${x},${y}`
    })
    .join(" ")

  return (
    <>
      <div className="dashboard-title">
        <div>
          <span className="eyebrow">Business overview</span>
          <h1>Magandang araw, {context.businessName}!</h1>
          <p>Confirmed real-time business records · Philippine Standard Time</p>
        </div>
        <div className="dashboard-actions"><Button variant="secondary" onClick={() => onNavigate("inventory")}><Search size={18}/> Scan product</Button><Button onClick={() => onNavigate("pos")}><Plus size={18} /> New sale / Open register</Button></div>
      </div>
      {!products.isLoading && products.data?.length === 0 && (
        <div className="setup-banner">
          <div className="setup-icon">
            <Package />
          </div>
          <div>
            <b>Add your first product</b>
            <p>Create a product and opening stock before checkout.</p>
          </div>
          <Button variant="secondary" onClick={() => onNavigate("inventory")}>
            Add first product
          </Button>
        </div>
      )}
      {(products.error || sales.error) && (
        <div className="form-message">
          The Phase 2 migration may still need to be applied. Check the setup
          instructions and retry.
        </div>
      )}
      <div className="kpi-grid">
        {[
          ["Today’s gross sales", peso(totals.total)],
          ["Completed transactions", String(sales.data?.length ?? 0)],
          ["Items sold", String(totals.items)],
          ["Low-stock products", String(lowStock)],
        ].map(([label, value], index) => (
          <article className={`kpi-card kpi-card-${index + 1}`} key={label}>
            <span>{label}</span>
            <strong>{sales.isLoading || products.isLoading ? "—" : value}</strong>
            <small>{index === 3 && lowStock > 0 ? "Items under threshold" : "Confirmed synchronized data"}</small>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <article className="panel sales-chart-panel">
          <div className="panel-title">
            <div>
              <h2>Sales overview</h2>
              <p>Live completed sales · Philippine time</p>
            </div>
            <span className="live-data-pill"><i /> Live</span>
          </div>
          <div className="sales-chart-summary">
            <div><small>Today’s sales</small><strong>{peso(totals.total)}</strong></div>
            <div><small>Transactions</small><strong>{sales.data?.length ?? 0}</strong></div>
          </div>
          <div className="sales-chart" role="img" aria-label={`Hourly sales chart showing ${peso(totals.total)} across ${sales.data?.length ?? 0} completed transactions today`}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="sales-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a085" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#16a085" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[16, 40, 64, 88].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} className="chart-grid-line" />)}
              <polygon points={`0,88 ${chartPoints} 100,88`} className="chart-area" />
              <polyline points={chartPoints} className="chart-line" />
              {hourlySales.map((bucket, index) => (
                <circle key={bucket.label} cx={(index / (hourlySales.length - 1)) * 100} cy={88 - (bucket.total / chartMaximum) * 72} r="1.25" className="chart-point" />
              ))}
            </svg>
            <div className="sales-chart-labels">
              {hourlySales.filter((_, index) => index % 2 === 0).map((bucket) => <span key={bucket.label}>{bucket.label}</span>)}
            </div>
          </div>
          {!sales.isLoading && !sales.data?.length && <p className="sales-chart-empty">Complete a checkout to start the live sales chart.</p>}
        </article>
        <article className="panel quick-start">
          <div className="panel-title">
            <div>
              <h2>Quick actions</h2>
              <p>Continue running your store</p>
            </div>
          </div>
          <Button variant="ghost" className="task" onClick={() => onNavigate("inventory")}>
            <span>1</span><b>Add products and prices</b><ArrowRight size={17} />
          </Button>
          <Button variant="ghost" className="task" onClick={() => onNavigate("inventory")}>
            <span>2</span><b>Receive opening stock</b><ArrowRight size={17} />
          </Button>
          <Button variant="ghost" className="task" onClick={() => onNavigate("pos")}>
            <span>3</span><b>Complete a cash sale</b><ArrowRight size={17} />
          </Button>
        </article>
      </div>
    </>
  )
}

export function ProductsView({ context }: { context: BusinessContext }) {
  const queryClient = useQueryClient()
  const products = useProducts(context)
  const [open, setOpen] = useState(false)
  const [barcode, setBarcode] = useState("")
  const [productName, setProductName] = useState("")
  const [productImage, setProductImage] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const lookupSequence = useRef(0)

  async function prepareNewBarcode(value: string) {
    const normalized = value.trim()
    if (!normalized) return

    const existing = products.data?.find((product) =>
      product.product_barcodes.some((item) => item.barcode === normalized),
    )
    if (existing) {
      const sequence = ++lookupSequence.current
      setLookupBusy(true)
      setMessage(`${existing.name} already uses barcode ${normalized}.`)
      setProductName(existing.name)
      setBarcode(normalized)
      setOpen(true)
      try {
        const match = await lookupOpenFoodFactsProduct(normalized)
        if (sequence === lookupSequence.current) setProductImage(match?.imageUrl ?? null)
      } catch {
        if (sequence === lookupSequence.current) setProductImage(null)
      } finally {
        if (sequence === lookupSequence.current) setLookupBusy(false)
      }
      return
    }

    setBarcode(normalized)
    setProductImage(null)
    setOpen(true)
    setMessage(`Looking up barcode ${normalized} in Open Food Facts…`)
    const sequence = ++lookupSequence.current
    setLookupBusy(true)

    try {
      const match = await lookupOpenFoodFactsProduct(normalized)
      if (sequence !== lookupSequence.current) return
      if (match) {
        setProductName((current) => current.trim() || match.name)
        setProductImage(match.imageUrl)
        setMessage(
          "Product details found via Open Food Facts. Confirm the name and enter your store prices.",
        )
      } else {
        setProductImage(null)
        setMessage(
          `Barcode ${normalized} was not found in Open Food Facts. Enter the product details manually.`,
        )
      }
    } catch {
      if (sequence !== lookupSequence.current) return
      setMessage(
        `Open Food Facts is unavailable right now. Barcode ${normalized} is ready for manual entry.`,
      )
    } finally {
      if (sequence === lookupSequence.current) setLookupBusy(false)
    }
  }

  function closeNewProductForm() {
    lookupSequence.current += 1
    setLookupBusy(false)
    setBarcode("")
    setProductName("")
    setProductImage(null)
    setMessage("")
    setOpen(false)
  }

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const price = parseCentavos(String(values.get("price")))
    const cost = parseCentavos(String(values.get("cost")))
    const opening = Number(values.get("opening"))
    if (price === null || cost === null || !Number.isFinite(opening) || opening < 0) {
      return setMessage("Enter valid prices and opening stock.")
    }
    setBusy(true)
    setMessage("")
    const { error } = await supabase.rpc("create_product_with_barcode", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_name: String(values.get("name")),
      p_sku: String(values.get("sku")),
      p_barcode: String(values.get("barcode")),
      p_price_centavos: price,
      p_cost_centavos: cost,
      p_opening_quantity: opening,
      p_idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    event.currentTarget.reset()
    closeNewProductForm()
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const values = new FormData(event.currentTarget)
    const price = parseCentavos(String(values.get("price")))
    const cost = parseCentavos(String(values.get("cost")))
    if (price === null || cost === null) return setMessage("Enter valid prices.")
    setBusy(true)
    const { error } = await supabase
      .from("products")
      .update({
        name: String(values.get("name")).trim(),
        sku: String(values.get("sku")).trim() || null,
        price_centavos: price,
        cost_centavos: cost,
        minimum_stock: Number(values.get("minimumStock")),
      })
      .eq("id", editing.id)
      .eq("business_id", context.businessId)
    setBusy(false)
    if (error) return setMessage(error.message)
    setEditing(null)
    setMessage("Product updated successfully.")
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  async function archiveProduct(product: Product) {
    if (!window.confirm(`Archive ${product.name}? It will no longer appear in checkout.`)) return
    const { error } = await supabase
      .from("products")
      .update({ status: "archived" })
      .eq("id", product.id)
      .eq("business_id", context.businessId)
    if (error) return setMessage(error.message)
    setMessage(`${product.name} was archived.`)
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  return (
    <section>
      <div className="dashboard-title">
        <div><span className="eyebrow">Catalog</span><h1>Products</h1><p>Real products and current confirmed stock.</p></div>
        <Button onClick={() => open ? closeNewProductForm() : setOpen(true)}><Plus size={18} /> Add product</Button>
      </div>
      <BarcodeScanner
        onDetected={(value) => void prepareNewBarcode(value)}
      />
      {open && (
        <form className="inline-form panel" onSubmit={addProduct}>
          {barcode && <div className="barcode-product-preview">
            {productImage ? <img src={productImage} alt={`${productName || "Scanned product"} package`} /> : <span className="barcode-product-placeholder"><Package /></span>}
            <div><b>{productName || "Scanned product"}</b><small>Barcode: {barcode}</small><span className="image-source-copy">{productImage ? "Product image from Open Food Facts" : "No product image available"}</span></div>
          </div>}
          <Field label="Product name" name="name" required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Product name" />
          <Field label="SKU" name="sku" placeholder="Optional SKU" />
          <Field label="Barcode" name="barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} onBlur={() => void prepareNewBarcode(barcode)} placeholder="Scan or enter barcode" />
          <Field label="Selling price" name="price" required inputMode="decimal" placeholder="0.00" />
          <Field label="Cost price" name="cost" required inputMode="decimal" placeholder="0.00" />
          <Field label="Opening stock" name="opening" required type="number" min="0" step="0.001" defaultValue="0" />
          <div className="inline-form-actions"><Button type="button" variant="ghost" onClick={closeNewProductForm}>Cancel</Button><Button type="submit" loading={busy} disabled={lookupBusy}>Save product</Button></div>
          {message && <div className="form-message">{message}</div>}
        </form>
      )}
      {editing && (
        <form className="inline-form edit-product-form panel" onSubmit={updateProduct}>
          <Field label="Product name" name="name" required defaultValue={editing.name} />
          <Field label="SKU" name="sku" defaultValue={editing.sku ?? ""} />
          <Field label="Selling price" name="price" required inputMode="decimal" defaultValue={(editing.price_centavos / 100).toFixed(2)} />
          <Field label="Cost price" name="cost" required inputMode="decimal" defaultValue={(editing.cost_centavos / 100).toFixed(2)} />
          <Field label="Low-stock threshold" name="minimumStock" required type="number" min="0" step="0.001" defaultValue={editing.minimum_stock} />
          <div className="inline-form-actions"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" loading={busy}>Save changes</Button></div>
        </form>
      )}
      {products.isLoading ? <p className="loading-copy">Loading products…</p> :
        products.data?.length ? (
          <div className="data-table panel">
            <div className="table-row product-row table-head"><span>Product</span><span>SKU / barcode</span><span>Price</span><span>Stock</span><span>Actions</span></div>
            {products.data.map((product) => (
              <div className="table-row product-row" key={product.id}>
                <span><b>{product.name}</b></span>
                <span>{product.sku || product.product_barcodes[0]?.barcode || "—"}</span>
                <span>{peso(product.price_centavos)}</span>
                <span>{Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)}</span>
                <span className="row-actions"><Button variant="ghost" aria-label={`Edit ${product.name}`} onClick={() => { setEditing(product); setOpen(false); }}><Pencil size={15}/></Button><Button variant="ghost" aria-label={`Archive ${product.name}`} onClick={() => archiveProduct(product)}><Archive size={15}/></Button></span>
              </div>
            ))}
          </div>
        ) : <Empty icon={Package} title="No products yet" copy="Add your first product to begin inventory and checkout." />}
    </section>
  )
}

export function InventoryView({ context }: { context: BusinessContext }) {
  const queryClient = useQueryClient()
  const products = useProducts(context)
  const [selected, setSelected] = useState<Product | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [newProduct, setNewProduct] = useState<{
    barcode: string
    name: string
    imageUrl: string | null
  } | null>(null)
  const inventoryScanSequence = useRef(0)
  const [quantity, setQuantity] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)

  const quantityOptions = [1, 2, 3, 5, 10, 12, 20, 24, 25, 50, 100]

  async function receive() {
    const amount = Number(quantity)
    if (!selected || !Number.isFinite(amount) || amount <= 0) return setMessage("Enter a quantity greater than zero.")
    setBusy(true)
    const { error } = await supabase.rpc("receive_stock", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_product_id: selected.id,
      p_quantity: amount,
      p_reason: "Manual stock receiving",
      p_idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    setMessage(`${selected.name} stock updated successfully.`)
    setSelected(null)
    setSelectedImage(null)
    setQuantity("")
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  async function addScannedProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newProduct) return
    const values = new FormData(event.currentTarget)
    const price = parseCentavos(String(values.get("price")))
    const minimumStock = Number(values.get("minimumStock"))
    const openingQuantity = Number(values.get("openingQuantity"))
    const name = String(values.get("name")).trim()
    if (!name || price === null || !Number.isFinite(minimumStock) || minimumStock < 0 || !Number.isFinite(openingQuantity) || openingQuantity < 0) {
      return setMessage("Enter valid product details, price, threshold, and quantity.")
    }

    setBusy(true)
    setMessage("")
    const { data: productId, error } = await supabase.rpc("create_product_with_barcode", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_name: name,
      p_sku: "",
      p_barcode: newProduct.barcode,
      p_price_centavos: price,
      p_cost_centavos: 0,
      p_opening_quantity: openingQuantity,
      p_idempotency_key: crypto.randomUUID(),
    })
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }
    const { error: detailsError } = await supabase
      .from("products")
      .update({
        unit: String(values.get("unit")),
        minimum_stock: minimumStock,
        image_path: newProduct.imageUrl,
      })
      .eq("id", productId)
      .eq("business_id", context.businessId)
    setBusy(false)
    if (detailsError) return setMessage(detailsError.message)
    setMessage(`${name} was added to inventory.`)
    setNewProduct(null)
    setQuantity("")
    await queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  async function scanInventoryProduct(value: string) {
    const product = products.data?.find((item) =>
      item.product_barcodes.some((barcode) => barcode.barcode === value),
    )
    if (!product) {
      const sequence = ++inventoryScanSequence.current
      setSelected(null)
      setSelectedImage(null)
      setNewProduct({ barcode: value, name: "", imageUrl: null })
      setLookupBusy(true)
      setMessage(`Barcode ${value} is new. Looking up product information…`)
      try {
        const details = await lookupOpenFoodFactsProduct(value)
        if (sequence !== inventoryScanSequence.current) return
        setNewProduct({
          barcode: value,
          name: details?.name ?? "",
          imageUrl: details?.imageUrl ?? null,
        })
        setMessage(details ? "Product information found. Confirm the details below." : "Barcode scanned successfully. Enter the product details below.")
        return {
          name: details?.name ?? "New scanned product",
          barcode: value,
          imageUrl: details?.imageUrl,
          detail: "Not yet in inventory · complete the product form to add it",
          value: "Enter the selling price in the inventory form",
          status: "new" as const,
          actionLabel: "Add to inventory",
        }
      } catch {
        if (sequence !== inventoryScanSequence.current) return
        setMessage("Barcode scanned successfully. Product lookup is unavailable, so enter the details below.")
        return {
          name: "New scanned product",
          barcode: value,
          detail: "Not yet in inventory · enter the product details below",
          value: "Enter the selling price in the inventory form",
          status: "new" as const,
          actionLabel: "Add to inventory",
        }
      } finally {
        if (sequence === inventoryScanSequence.current) setLookupBusy(false)
      }
    }
    setLookupBusy(false)
    setNewProduct(null)
    setSelected(product)
    setSelectedImage(product.image_path)
    setMessage(`${product.name} found. Enter stock quantity to confirm.`)
    const sequence = ++inventoryScanSequence.current
    const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)
    if (product.image_path) return {
      name: product.name,
      barcode: value,
      imageUrl: product.image_path,
      detail: `${stock} ${product.unit} currently in stock`,
      value: peso(product.price_centavos),
      status: "existing" as const,
      actionLabel: "Add stock",
    }
    let imageUrl: string | null = null
    try {
      const details = await lookupOpenFoodFactsProduct(value)
      imageUrl = details?.imageUrl ?? null
      if (sequence === inventoryScanSequence.current) setSelectedImage(imageUrl)
    } catch {
      if (sequence === inventoryScanSequence.current) setSelectedImage(null)
    }
    return {
      name: product.name,
      barcode: value,
      imageUrl,
      detail: `${stock} ${product.unit} currently in stock`,
      value: peso(product.price_centavos),
      status: "existing" as const,
      actionLabel: "Add stock",
    }
  }

  return (
    <section>
      <div className="dashboard-title inventory-dashboard-title"><div><div className="pos-title-line"><h1>Inventory</h1><BarcodeScanner compact onDetected={scanInventoryProduct} /></div><p>Receive stock only after confirmation.</p></div></div>
      {message && <div className="form-message workspace-message">{message}</div>}
      {newProduct && <form className="inline-form inventory-new-product-form panel" onSubmit={addScannedProduct}>
        <div className="barcode-product-preview">
          {newProduct.imageUrl ? <img src={newProduct.imageUrl} alt={`${newProduct.name || "Scanned product"} package`} /> : <span className="barcode-product-placeholder"><Package /></span>}
          <div><b>{newProduct.name || "New scanned product"}</b><small>Barcode: {newProduct.barcode}</small><span className="image-source-copy">{newProduct.imageUrl ? "Product image found" : "No product image available"}</span></div>
        </div>
        <Field label="Product name" name="name" required value={newProduct.name} onChange={(event) => setNewProduct((current) => current ? { ...current, name: event.target.value } : current)} placeholder="Product name" />
        <Field label="Selling price" name="price" required inputMode="decimal" placeholder="0.00" />
        <SelectField label="Minimum threshold" name="minimumStock" defaultValue="5">
          <option value="0">0</option>{quantityOptions.map((amount) => <option value={amount} key={amount}>{amount}</option>)}
        </SelectField>
        <SelectField label="Unit" name="unit" defaultValue="piece">
          <option value="piece">Piece</option><option value="pack">Pack</option><option value="box">Box</option><option value="bottle">Bottle</option><option value="kilogram">Kilogram</option><option value="liter">Liter</option>
        </SelectField>
        <SelectField label="Opening quantity" name="openingQuantity" defaultValue="1">
          <option value="0">0</option>{quantityOptions.map((amount) => <option value={amount} key={amount}>{amount}</option>)}
        </SelectField>
        <Field label="Barcode" name="barcode" value={newProduct.barcode} readOnly />
        <div className="inline-form-actions"><Button type="button" variant="ghost" onClick={() => { inventoryScanSequence.current += 1; setLookupBusy(false); setNewProduct(null); setMessage(""); }}>Cancel</Button><Button type="submit" loading={busy} disabled={lookupBusy}>Add product</Button></div>
      </form>}
      {selected && <div className="barcode-product-preview inventory-scan-result">
        {selectedImage ? <img src={selectedImage} alt={`${selected.name} package`} /> : <span className="barcode-product-placeholder"><Package /></span>}
        <div><b>{selected.name}</b><small>Barcode: {selected.product_barcodes[0]?.barcode || "Not assigned"}</small><strong>{Number(selected.inventory_balances[0]?.confirmed_quantity ?? 0)} currently in stock</strong></div>
      </div>}
      {selected && <div className="receive-panel panel"><div><b>Receive {selected.name}</b><small>Current stock: {Number(selected.inventory_balances[0]?.confirmed_quantity ?? 0)} {selected.unit}</small></div><SelectField label="Quantity to add" value={quantity} onChange={(e) => setQuantity(e.target.value)}><option value="">Select quantity</option>{quantityOptions.map((amount) => <option value={amount} key={amount}>{amount}</option>)}</SelectField><Button variant="ghost" onClick={() => { inventoryScanSequence.current += 1; setSelected(null); setSelectedImage(null); }}>Cancel</Button><Button loading={busy} onClick={receive}>Add stock</Button></div>}
      {products.data?.length ? <div className="inventory-grid">{products.data.map((product) => <article className="inventory-card" key={product.id}>{product.image_path ? <img className="product-list-image" src={product.image_path} alt={`${product.name} package`} /> : <span className="inventory-icon"><Package /></span>}<div><b>{product.name}</b><small>{product.sku || "No SKU"}</small></div><strong>{Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)}</strong><Button variant="secondary" onClick={() => { inventoryScanSequence.current += 1; setSelectedImage(product.image_path); setSelected(product); setMessage(""); }}>Add stock</Button></article>)}</div> : !products.isLoading && <Empty icon={Package} title="No inventory yet" copy="Create a product before receiving stock." />}
    </section>
  )
}

type CartLine = { product: Product; quantity: number }

export function PosView({ context }: { context: BusinessContext }) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const products = useProducts(context)
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [tendered, setTendered] = useState("")
  const [message, setMessage] = useState("")
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [scannedImage, setScannedImage] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const scanSequence = useRef(0)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{
    receipt_number: string
    total_centavos: number
    change_centavos: number
    tendered_centavos: number
    completed_at: string
    lines: CartLine[]
  } | null>(null)
  const lines = Object.values(cart)
  const cartItemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
  const visibleProducts = (products.data ?? []).filter((product) =>
    `${product.name} ${product.sku ?? ""} ${product.product_barcodes[0]?.barcode ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const total = lines.reduce((sum, line) => sum + line.product.price_centavos * line.quantity, 0)

  function setQuantity(product: Product, quantity: number) {
    const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)
    if (quantity > stock) return setMessage(`Only ${stock} ${product.name} available.`)
    setMessage("")
    setCart((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[product.id]
      else next[product.id] = { product, quantity }
      return next
    })
  }

  async function checkout() {
    const cash = parseCentavos(tendered)
    if (!lines.length) return setMessage("Add at least one product.")
    if (cash === null || cash < total) return setMessage("Cash received must cover the total.")
    setBusy(true)
    setMessage("")
    const { data, error } = await supabase.rpc("complete_cash_sale", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
      p_tendered_centavos: cash,
      p_idempotency_key: crypto.randomUUID(),
    })
    if (error) {
      setBusy(false)
      return setMessage(error.message)
    }
    const result = data as {
      receipt_number: string
      total_centavos: number
      change_centavos: number
    }
    const completedReceipt = {
      ...result,
      tendered_centavos: cash,
      completed_at: new Date().toISOString(),
      lines,
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-sales"] }),
      queryClient.invalidateQueries({ queryKey: ["sales"] }),
    ])
    setReceipt(completedReceipt)
    setCart({})
    setTendered("")
    setScannedProduct(null)
    setScannedImage(null)
    setCartOpen(false)
    setBusy(false)
  }

  async function scanCheckoutProduct(value: string) {
    const product = products.data?.find((item) =>
      item.product_barcodes.some((barcode) => barcode.barcode === value),
    )
    if (!product) {
      scanSequence.current += 1
      setScannedProduct(null)
      setScannedImage(null)
      setMessage(`Product not found for barcode ${value}.`)
      return
    }
    setScannedProduct(product)
    setScannedImage(product.image_path)
    setQuantity(product, (cart[product.id]?.quantity ?? 0) + 1)
    const sequence = ++scanSequence.current
    const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)
    if (product.image_path) return {
      name: product.name,
      barcode: value,
      imageUrl: product.image_path,
      detail: `${stock} ${product.unit} available · added to basket`,
      value: peso(product.price_centavos),
      status: "existing" as const,
      actionLabel: "View checkout",
    }
    let imageUrl: string | null = null
    try {
      const details = await lookupOpenFoodFactsProduct(value)
      imageUrl = details?.imageUrl ?? null
      if (sequence === scanSequence.current) setScannedImage(imageUrl)
    } catch {
      if (sequence === scanSequence.current) setScannedImage(null)
    }
    return {
      name: product.name,
      barcode: value,
      imageUrl,
      detail: `${stock} ${product.unit} available · added to basket`,
      value: peso(product.price_centavos),
      status: "existing" as const,
      actionLabel: "View checkout",
    }
  }

  return (
    <section className="pos-page">
      <div className="dashboard-title pos-dashboard-title"><div><div className="pos-title-line"><h1>POS / Checkout</h1><BarcodeScanner compact onDetected={scanCheckoutProduct} /></div></div></div>
      {receipt && <ReceiptDialog context={context} receipt={receipt} onClose={() => setReceipt(null)} />}
      {cartOpen && <button className="mobile-cart-scrim" aria-label="Close basket" onClick={() => setCartOpen(false)} />}
      <div className="pos-layout">
        <div className="product-browser panel">
          {scannedProduct && <div className="barcode-product-preview checkout-scan-result">
            {scannedImage ? <img src={scannedImage} alt={`${scannedProduct.name} package`} /> : <span className="barcode-product-placeholder"><Package /></span>}
            <div><b>{scannedProduct.name}</b><small>{scannedProduct.product_barcodes[0]?.barcode || scannedProduct.sku || "Scanned product"}</small><strong>{peso(scannedProduct.price_centavos)}</strong></div>
            <Button variant="ghost" aria-label="Dismiss scanned product" onClick={() => { scanSequence.current += 1; setScannedProduct(null); setScannedImage(null) }}>×</Button>
          </div>}
          <label className="product-search"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" /></label>
          <div className="product-card-grid">
            {visibleProducts.map((product) => {
              const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0)
              return <article className="pos-product" key={product.id}>{product.image_path ? <img className="pos-product-image" src={product.image_path} alt={`${product.name} package`} /> : <span className="inventory-icon"><Package /></span>}<b>{product.name}</b><small>{stock} in stock</small><strong>{peso(product.price_centavos)}</strong><Button disabled={stock <= 0} onClick={() => setQuantity(product, (cart[product.id]?.quantity ?? 0) + 1)}>{stock <= 0 ? "Out of stock" : "Add to basket"}</Button></article>
            })}
          </div>
          {!products.isLoading && !visibleProducts.length && <Empty icon={Search} title="No matching products" copy="Add products or try another search." />}
        </div>
        <aside className={`cart-panel panel ${cartOpen ? "mobile-cart-open" : ""}`} aria-label="Checkout basket">
          <div className="cart-heading"><div><ShoppingCart/><b>Active basket</b><span className="cart-heading-count">{cartItemCount}</span></div><div className="cart-heading-actions"><Button variant="ghost" disabled={!lines.length} onClick={() => setCart({})}><Trash2 size={17}/> Clear</Button><Button variant="ghost" className="mobile-cart-close" aria-label="Close basket" onClick={() => setCartOpen(false)}><X size={19}/></Button></div></div>
          <div className="cart-lines">
            {lines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-line-product">{product.image_path ? <img src={product.image_path} alt={`${product.name} package`} /> : <span><Package size={17} /></span>}<div><b>{product.name}</b><small>{peso(product.price_centavos)} each</small></div></div><div className="quantity-control"><Button variant="ghost" onClick={() => setQuantity(product, quantity - 1)}><Minus size={15}/></Button><span>{quantity}</span><Button variant="ghost" onClick={() => setQuantity(product, quantity + 1)}><Plus size={15}/></Button></div><strong>{peso(product.price_centavos * quantity)}</strong></div>)}
            {!lines.length && <Empty icon={ShoppingCart} title="Basket is empty" copy="Choose a product to begin." />}
          </div>
          <div className="cart-total"><span>Total</span><strong>{peso(total)}</strong></div>
          <Field label="Cash received" value={tendered} onChange={(e) => setTendered(e.target.value)} inputMode="decimal" placeholder="0.00" />
          {message && <div className="form-message">{message}</div>}
          <Button className="checkout-button" loading={busy} disabled={!lines.length} onClick={checkout}>Complete cash sale</Button>
        </aside>
      </div>
      <Button className="mobile-cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Open basket with ${cartItemCount} items`}>
        <span className="mobile-cart-icon"><ShoppingCart size={21}/>{cartItemCount > 0 && <b>{cartItemCount}</b>}</span>
        <span>View basket</span>
        <strong>{peso(total)}</strong>
      </Button>
    </section>
  )
}

export function SalesView({ context }: { context: BusinessContext }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [startTime, setStartTime] = useState("00:00")
  const [endTime, setEndTime] = useState("23:59")
  const products = useProducts(context)
  const safeStartDate = startDate || today
  const safeEndDate = endDate || today
  const safeStartTime = startTime || "00:00"
  const safeEndTime = endTime || "23:59"
  const from = new Date(`${safeStartDate}T${safeStartTime}:00+08:00`).toISOString()
  const to = new Date(`${safeEndDate}T${safeEndTime}:59+08:00`).toISOString()
  const sales = useQuery({
    queryKey: ["sales-report", context.branchId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,receipt_number,total_centavos,item_count,status,completed_at,sale_items(product_name,sku,quantity,unit_price_centavos,line_total_centavos)")
        .eq("branch_id", context.branchId)
        .gte("completed_at", from)
        .lte("completed_at", to)
        .order("completed_at", { ascending: false })
        .limit(1000)
      if (error) throw error
      return data ?? []
    },
  })
  const completedSales = (sales.data ?? []).filter((sale) => sale.status === "completed")
  const totalSales = completedSales.reduce((sum, sale) => sum + Number(sale.total_centavos), 0)
  const totalItems = completedSales.reduce((sum, sale) => sum + Number(sale.item_count), 0)
  const remainingStock = (products.data ?? []).reduce((sum, product) => sum + Number(product.inventory_balances[0]?.confirmed_quantity ?? 0), 0)
  const lowStock = (products.data ?? []).filter((product) => Number(product.inventory_balances[0]?.confirmed_quantity ?? 0) <= Number(product.minimum_stock)).length

  function downloadSalesCsv() {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const rows = (sales.data ?? []).flatMap((sale) => {
      const items = sale.sale_items?.length ? sale.sale_items : [{ product_name: "", sku: "", quantity: sale.item_count, unit_price_centavos: null, line_total_centavos: sale.total_centavos }]
      return items.map((item) => [
        sale.receipt_number,
        new Intl.DateTimeFormat("en-PH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(sale.completed_at)),
        item.product_name,
        item.sku,
        item.quantity,
        item.unit_price_centavos == null ? "" : (Number(item.unit_price_centavos) / 100).toFixed(2),
        (Number(item.line_total_centavos) / 100).toFixed(2),
        sale.status,
      ])
    })
    const csv = [
      ["Receipt", "Date and time (PST)", "Product", "SKU", "Quantity", "Unit price (PHP)", "Line total (PHP)", "Status"],
      ...rows,
    ].map((row) => row.map(escapeCsv).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `smartpos-sales-${startDate}-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <section className="sales-report-page">
    <div className="dashboard-title"><div><span className="eyebrow">Transaction records</span><h1>Sales & Reports</h1><p>Sales performance and inventory position for the selected period.</p></div><Button onClick={downloadSalesCsv} disabled={!sales.data?.length}><Download size={17} /> Download CSV</Button></div>
    <div className="report-filters panel">
      <Field label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      <Field label="Start time" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
      <Field label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      <Field label="End time" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
    </div>
    <div className="report-summary-grid">
      <article className="report-summary-card"><span>{startDate === today && endDate === today ? "Total sales today" : "Total sales"}</span><strong>{peso(totalSales)}</strong><small>{completedSales.length} completed transactions</small></article>
      <article className="report-summary-card"><span>Total items sold</span><strong>{totalItems}</strong><small>Within selected date and time</small></article>
      <article className="report-summary-card"><span>Remaining stocks</span><strong>{remainingStock}</strong><small>Across {products.data?.length ?? 0} active products</small></article>
      <article className="report-summary-card warning"><span>Low stock products</span><strong>{lowStock}</strong><small>At or below minimum threshold</small></article>
    </div>
    {(sales.error || products.error) && <div className="form-message">Unable to load the complete report. Check the database connection and try again.</div>}
    <div className="report-section-heading"><div><h2>Sales logs</h2><p>{startDate} {startTime} to {endDate} {endTime} · Philippine time</p></div><span>{sales.data?.length ?? 0} records</span></div>
    {sales.data?.length ? <div className="data-table panel"><div className="table-row sales-row table-head"><span>Receipt</span><span>Date</span><span>Items</span><span>Status</span><span>Total</span></div>{sales.data.map((sale)=><div className="table-row sales-row" key={sale.id}><span><b>{sale.receipt_number}</b></span><span>{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(sale.completed_at))}</span><span>{Number(sale.item_count)}</span><span className="status-chip">{sale.status}</span><span><b>{peso(sale.total_centavos)}</b></span></div>)}</div> : !sales.isLoading && <Empty icon={ReceiptText} title="No sales in this range" copy="Choose another date or time range to view transaction logs." />}
    <div className="report-section-heading"><div><h2>Remaining inventory</h2><p>Current confirmed quantities for this branch.</p></div></div>
    {products.data?.length ? <div className="inventory-report-grid">{products.data.map((product) => { const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0); return <article key={product.id}><div>{product.image_path ? <img src={product.image_path} alt="" /> : <span><Package size={18} /></span>}<div><b>{product.name}</b><small>{product.sku || "No SKU"}</small></div></div><strong>{stock} {product.unit}</strong><em className={stock <= Number(product.minimum_stock) ? "low" : "healthy"}>{stock <= Number(product.minimum_stock) ? "Low stock" : "In stock"}</em></article> })}</div> : !products.isLoading && <Empty icon={Package} title="No inventory records" copy="Products and remaining stock will appear here." />}
  </section>
}

type WalletLedgerEntry = {
  id: string
  wallet_provider: "gcash" | "maya"
  transaction_type: "cash_in" | "cash_out"
  amount_centavos: number
  service_fee_centavos: number
  reference: string | null
  notes: string | null
  created_at: string
}

export function DigitalLedgerView({ context }: { context: BusinessContext }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [selectedWallet, setSelectedWallet] = useState<WalletLedgerEntry["wallet_provider"]>("gcash")
  const [selectedTransaction, setSelectedTransaction] = useState<WalletLedgerEntry["transaction_type"]>("cash_in")
  const [referenceDraft, setReferenceDraft] = useState("")
  const [referenceSearch, setReferenceSearch] = useState("")
  const transactionFormRef = useRef<HTMLFormElement>(null)
  const entries = useQuery({
    queryKey: ["digital-wallet-ledger", context.branchId, referenceSearch],
    queryFn: async () => {
      let query = supabase
        .from("digital_wallet_ledger_entries")
        .select("id,wallet_provider,transaction_type,amount_centavos,service_fee_centavos,reference,notes,created_at")
        .eq("business_id", context.businessId)
        .eq("branch_id", context.branchId)
        .order("created_at", { ascending: false })
        .limit(100)
      if (referenceSearch) query = query.ilike("reference", `%${referenceSearch}%`)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as WalletLedgerEntry[]
    },
  })
  const balances = useQuery({
    queryKey: ["digital-wallet-balances", context.branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_wallet_balances")
        .select("wallet_provider,balance_centavos,profit_centavos")
        .eq("business_id", context.businessId)
        .eq("branch_id", context.branchId)
      if (error) throw error
      return data ?? []
    },
  })
  const balance = (provider: WalletLedgerEntry["wallet_provider"]) =>
    Number(balances.data?.find((item) => item.wallet_provider === provider)?.balance_centavos ?? 0)
  const profit = (provider: WalletLedgerEntry["wallet_provider"]) =>
    Number(balances.data?.find((item) => item.wallet_provider === provider)?.profit_centavos ?? 0)

  function prepareTransaction(provider: WalletLedgerEntry["wallet_provider"], transactionType: WalletLedgerEntry["transaction_type"]) {
    setSelectedWallet(provider)
    setSelectedTransaction(transactionType)
    setMessage("")
    transactionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    requestAnimationFrame(() => transactionFormRef.current?.querySelector<HTMLInputElement>('input[name="amount"]')?.focus())
  }

  async function recordTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage("")
    const form = event.currentTarget
    const values = new FormData(form)
    const amount = parseCentavos(String(values.get("amount") ?? ""))
    const feeInput = String(values.get("serviceFee") ?? "").trim()
    const serviceFee = feeInput ? parseCentavos(feeInput) : 0
    if (!amount || amount <= 0) {
      setMessage("Enter a valid amount greater than zero.")
      return
    }
    if (serviceFee === null || serviceFee < 0) {
      setMessage("Enter a valid service fee.")
      return
    }

    setBusy(true)
    const { error } = await supabase.rpc("record_digital_wallet_transaction", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_wallet_provider: String(values.get("wallet")),
      p_transaction_type: String(values.get("transactionType")),
      p_amount_centavos: amount,
      p_service_fee_centavos: serviceFee,
      p_reference: String(values.get("reference") ?? ""),
      p_notes: String(values.get("notes") ?? ""),
      p_idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) {
      setMessage(error.message)
      return
    }
    form.reset()
    setMessage("Wallet transaction recorded.")
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["digital-wallet-ledger", context.branchId] }),
      queryClient.invalidateQueries({ queryKey: ["digital-wallet-balances", context.branchId] }),
    ])
  }

  return (
    <section className="digital-ledger-page">
      <div className="dashboard-title">
        <div><span className="eyebrow">E-wallet records</span><h1>Digital Ledger</h1><p>Track GCash and Maya cash movements for this branch.</p></div>
      </div>
      <div className="wallet-balance-grid">
        <article className="wallet-balance-card gcash"><span>G</span><div className="wallet-balance-copy"><small>Current GCash balance</small><strong>{peso(balance("gcash"))}</strong><em>Service-fee profit: {peso(profit("gcash"))}</em><div className="wallet-balance-actions"><Button type="button" onClick={() => prepareTransaction("gcash", "cash_in")}>Add money</Button><Button type="button" variant="secondary" onClick={() => prepareTransaction("gcash", "cash_out")}>Cash out</Button></div></div></article>
        <article className="wallet-balance-card maya"><span>M</span><div className="wallet-balance-copy"><small>Current Maya balance</small><strong>{peso(balance("maya"))}</strong><em>Service-fee profit: {peso(profit("maya"))}</em><div className="wallet-balance-actions"><Button type="button" onClick={() => prepareTransaction("maya", "cash_in")}>Add money</Button><Button type="button" variant="secondary" onClick={() => prepareTransaction("maya", "cash_out")}>Cash out</Button></div></div></article>
      </div>
      <form ref={transactionFormRef} className="wallet-transaction-form panel" onSubmit={recordTransaction}>
        <div className="wallet-form-heading"><WalletCards size={22} /><div><b>Record wallet movement</b><small>Add a confirmed transaction and its service fee.</small></div></div>
        <SelectField label="Wallet" name="wallet" value={selectedWallet} onChange={(event) => setSelectedWallet(event.target.value as WalletLedgerEntry["wallet_provider"])}><option value="gcash">GCash</option><option value="maya">Maya</option></SelectField>
        <SelectField label="Transaction" name="transactionType" value={selectedTransaction} onChange={(event) => setSelectedTransaction(event.target.value as WalletLedgerEntry["transaction_type"])}><option value="cash_in">Cash in</option><option value="cash_out">Cash out</option></SelectField>
        <Field label="Amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        <Field label="Service fee (profit)" name="serviceFee" inputMode="decimal" placeholder="0.00" />
        <Field label="Reference number" name="reference" placeholder="Optional reference" />
        <Field label="Notes" name="notes" placeholder="Optional notes" />
        <div className="wallet-form-actions"><Button type="submit" loading={busy}>Save transaction</Button></div>
        {message && <div className="form-message wallet-form-message">{message}</div>}
      </form>
      <div className="report-section-heading wallet-activity-heading"><div><h2>Recent wallet activity</h2><p>Latest GCash and Maya transactions for {context.branchName}.</p></div><span>{entries.data?.length ?? 0} records</span></div>
      <form className="wallet-reference-search" onSubmit={(event) => { event.preventDefault(); setReferenceSearch(referenceDraft.trim()) }}>
        <label><Search size={18} /><input aria-label="Search reference number" value={referenceDraft} onChange={(event) => setReferenceDraft(event.target.value)} placeholder="Search reference number" /></label>
        <Button type="submit">Search</Button>
        {referenceSearch && <Button type="button" variant="ghost" onClick={() => { setReferenceDraft(""); setReferenceSearch("") }}>Clear</Button>}
      </form>
      {(entries.error || balances.error) && <div className="form-message">Unable to load the digital ledger. Apply the digital wallet migration and try again.</div>}
      {entries.data?.length ? <div className="wallet-ledger-list">{entries.data.map((entry) => <article key={entry.id}>
        <span className={`wallet-entry-icon ${entry.transaction_type}`}>{entry.transaction_type === "cash_in" ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span>
        <div><b>{entry.wallet_provider === "gcash" ? "GCash" : "Maya"} · {entry.transaction_type === "cash_in" ? "Cash in" : "Cash out"}</b><small>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(entry.created_at))}{entry.reference ? ` · Ref: ${entry.reference}` : ""}</small>{Number(entry.service_fee_centavos) > 0 && <small>Service fee profit: {peso(Number(entry.service_fee_centavos))}</small>}{entry.notes && <small>{entry.notes}</small>}</div>
        <strong className={entry.transaction_type}>{entry.transaction_type === "cash_in" ? "+" : "−"}{peso(Number(entry.amount_centavos))}</strong>
      </article>)}</div> : !entries.isLoading && !entries.error && <Empty icon={WalletCards} title={referenceSearch ? "No matching reference" : "No wallet activity yet"} copy={referenceSearch ? "Try another reference number or clear the search." : "Record your first GCash or Maya cash-in transaction."} />}
    </section>
  )
}

type Customer = {
  id: string
  name: string
  phone: string | null
  address: string | null
  credit_limit_centavos: number
  status: string
  customer_credit_accounts: Array<{ outstanding_centavos: number }>
}

function useCustomers(context: BusinessContext) {
  return useQuery({
    queryKey: ["customers", context.businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id,name,phone,address,credit_limit_centavos,status,customer_credit_accounts(outstanding_centavos)",
        )
        .eq("business_id", context.businessId)
        .order("name")
      if (error) throw error
      return (data ?? []) as Customer[]
    },
  })
}

function CustomerForm({
  context,
  onDone,
}: {
  context: BusinessContext
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const limit = parseCentavos(String(values.get("limit")))
    if (limit === null) return setMessage("Enter a valid credit limit.")
    setBusy(true)
    const { error } = await supabase.rpc("create_customer", {
      p_business_id: context.businessId,
      p_name: String(values.get("name")),
      p_phone: String(values.get("phone")),
      p_address: String(values.get("address")),
      p_credit_limit_centavos: limit,
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    await queryClient.invalidateQueries({ queryKey: ["customers"] })
    onDone()
  }
  return (
    <form className="inline-form customer-form panel" onSubmit={submit}>
      <Field label="Customer name" name="name" required placeholder="Full name" />
      <Field label="Contact number" name="phone" placeholder="09XX XXX XXXX" />
      <Field label="Address" name="address" placeholder="Optional address" />
      <Field label="Credit limit" name="limit" required defaultValue="0.00" inputMode="decimal" />
      <div className="inline-form-actions">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={busy}>Save customer</Button>
      </div>
      {message && <div className="form-message">{message}</div>}
    </form>
  )
}

export function CreditView({ context }: { context: BusinessContext }) {
  const customers = useCustomers(context)
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [repaying, setRepaying] = useState<Customer | null>(null)
  const [amount, setAmount] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const outstanding = (customers.data ?? []).reduce(
    (sum, customer) =>
      sum + Number(customer.customer_credit_accounts[0]?.outstanding_centavos ?? 0),
    0,
  )
  async function repay() {
    const centavos = parseCentavos(amount)
    if (!repaying || centavos === null || centavos <= 0) {
      return setMessage("Enter a valid repayment amount.")
    }
    setBusy(true)
    const { error } = await supabase.rpc("record_credit_repayment", {
      p_business_id: context.businessId,
      p_branch_id: context.branchId,
      p_customer_id: repaying.id,
      p_amount_centavos: centavos,
      p_notes: "Customer credit repayment",
      p_idempotency_key: crypto.randomUUID(),
    })
    setBusy(false)
    if (error) return setMessage(error.message)
    setRepaying(null)
    setAmount("")
    setMessage("Repayment recorded successfully.")
    await queryClient.invalidateQueries({ queryKey: ["customers"] })
  }
  return (
    <section>
      <div className="dashboard-title">
        <div><span className="eyebrow">Customer receivables</span><h1>Utang / Credit</h1><p>Outstanding balance: <b>{peso(outstanding)}</b></p></div>
        <Button onClick={() => setAdding(true)}><UserPlus size={18}/> Add customer</Button>
      </div>
      {adding && <CustomerForm context={context} onDone={() => setAdding(false)} />}
      {message && <div className="form-message workspace-message">{message}</div>}
      {repaying && <div className="receive-panel panel"><div><b>Record repayment from {repaying.name}</b><small>Outstanding: {peso(Number(repaying.customer_credit_accounts[0]?.outstanding_centavos ?? 0))}</small></div><Field label="Amount received" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00"/><Button variant="ghost" onClick={() => setRepaying(null)}>Cancel</Button><Button loading={busy} onClick={repay}>Record repayment</Button></div>}
      {customers.error && <div className="form-message">Apply migration 0004 to activate customer credit.</div>}
      {customers.data?.length ? <div className="data-table panel"><div className="table-row customer-row table-head"><span>Customer</span><span>Contact</span><span>Credit limit</span><span>Outstanding</span><span>Action</span></div>{customers.data.map((customer) => { const balance = Number(customer.customer_credit_accounts[0]?.outstanding_centavos ?? 0); return <div className="table-row customer-row" key={customer.id}><span><b>{customer.name}</b></span><span>{customer.phone || "—"}</span><span>{peso(customer.credit_limit_centavos)}</span><span><b>{peso(balance)}</b></span><span><Button variant="secondary" disabled={balance <= 0} onClick={() => { setRepaying(customer); setMessage(""); }}>Repayment</Button></span></div>})}</div> : !customers.isLoading && !customers.error && <Empty icon={CreditCard} title="No credit customers" copy="Add a customer to configure a credit limit and account." />}
    </section>
  )
}

export function PeopleView({ context }: { context: BusinessContext }) {
  const [adding, setAdding] = useState(false)
  const customers = useCustomers(context)
  const staff = useQuery({
    queryKey: ["staff", context.businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_members")
        .select("id,role,status,profiles(full_name,phone)")
        .eq("business_id", context.businessId)
        .order("created_at")
      if (error) throw error
      return data ?? []
    },
  })
  return (
    <section>
      <div className="dashboard-title"><div><span className="eyebrow">Business directory</span><h1>Customers & Staff</h1><p>People associated with this business.</p></div><Button onClick={() => setAdding(true)}><UserPlus size={18}/> Add customer</Button></div>
      {adding && <CustomerForm context={context} onDone={() => setAdding(false)} />}
      <div className="people-grid">
        <article className="panel"><div className="panel-title"><div><h2>Customers</h2><p>{customers.data?.length ?? 0} records</p></div></div>{customers.data?.length ? customers.data.map((customer)=><div className="person-row" key={customer.id}><span><Users/></span><div><b>{customer.name}</b><small>{customer.phone || "No contact number"}</small></div><i>{customer.status}</i></div>) : <Empty icon={Users} title="No customers" copy="Add your first customer to the directory." />}</article>
        <article className="panel"><div className="panel-title"><div><h2>Staff</h2><p>{staff.data?.length ?? 0} active memberships</p></div></div>{staff.data?.map((member) => { const profile = member.profiles as unknown as { full_name: string | null; phone: string | null }; return <div className="person-row" key={member.id}><span><Users/></span><div><b>{profile?.full_name || "Unnamed staff member"}</b><small>{profile?.phone || member.status}</small></div><i>{member.role}</i></div>})}</article>
      </div>
    </section>
  )
}

export function SettingsView({ context }: { context: BusinessContext }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const subscription = useQuery({
    queryKey: ["business-subscription", context.businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_subscriptions")
        .select("plan,status,billing_cycle,trial_started_at,trial_ends_at,current_period_ends_at")
        .eq("business_id", context.businessId)
        .single()
      if (error) throw error
      return data
    },
  })
  const settings = useQuery({
    queryKey: ["settings", context.businessId],
    queryFn: async () => {
      const [{ data: business, error: businessError }, { data: config, error: configError }] = await Promise.all([
        supabase.from("businesses").select("name,address,contact").eq("id", context.businessId).single(),
        supabase.from("business_settings").select("tax_mode,receipt_mode,receipt_footer,beginner_mode").eq("business_id", context.businessId).single(),
      ])
      if (businessError) throw businessError
      if (configError) throw configError
      return { ...business, ...config }
    },
  })
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true)
    const [{ error: businessError }, { error: settingsError }] = await Promise.all([
      supabase.from("businesses").update({ name: String(values.get("name")), address: String(values.get("address")), contact: String(values.get("contact")) }).eq("id", context.businessId),
      supabase.from("business_settings").update({ tax_mode: String(values.get("taxMode")), receipt_mode: String(values.get("receiptMode")), receipt_footer: String(values.get("footer")), beginner_mode: values.get("beginnerMode") === "on" }).eq("business_id", context.businessId),
    ])
    setBusy(false)
    if (businessError || settingsError) return setMessage((businessError || settingsError)?.message ?? "Unable to save settings.")
    setMessage("Business settings saved.")
    await Promise.all([queryClient.invalidateQueries({ queryKey: ["settings"] }), queryClient.invalidateQueries({ queryKey: ["current-business"] })])
  }
  const planName = subscription.data?.plan === "professional" ? "Professional" : subscription.data?.plan === "starter" ? "Starter" : "7-Day Free Trial"
  const planEnd = subscription.data?.status === "trialing" ? subscription.data.trial_ends_at : subscription.data?.current_period_ends_at
  return <section><div className="dashboard-title"><div><span className="eyebrow">Owner configuration</span><h1>Settings</h1><p>Business, tax, and internal receipt defaults.</p></div></div>{subscription.data && <article className="subscription-plan-card panel"><span><CreditCard size={23}/></span><div><small>Subscription plan</small><h2>{planName}</h2><p><b>{subscription.data.status}</b>{subscription.data.billing_cycle ? ` · ${subscription.data.billing_cycle} billing` : ""}{planEnd ? ` · Ends ${new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(planEnd))}` : ""}</p></div><em>{subscription.data.status}</em></article>}{subscription.error && <div className="form-message workspace-message">Apply the business subscription migration to view plan details.</div>}{settings.isLoading ? <p className="loading-copy">Loading settings…</p> : settings.data && <form className="settings-form panel" onSubmit={save}><Field label="Business name" name="name" required defaultValue={settings.data.name}/><Field label="Contact number" name="contact" required defaultValue={settings.data.contact}/><Field label="Business address" name="address" required defaultValue={settings.data.address}/><label className="field"><span>Tax mode</span><select className="input" name="taxMode" defaultValue={settings.data.tax_mode}><option value="non_vat">Non-VAT</option><option value="vat_registered">VAT-registered</option></select></label><label className="field"><span>Receipt mode</span><select className="input" name="receiptMode" defaultValue={settings.data.receipt_mode}><option value="internal">Internal POS receipt</option><option value="configured_invoice">Configured invoice issuance</option></select></label><Field label="Receipt footer" name="footer" defaultValue={settings.data.receipt_footer}/><label className="checkbox-field settings-checkbox"><input type="checkbox" name="beginnerMode" defaultChecked={settings.data.beginner_mode}/><span>Use beginner-friendly interface mode</span></label>{message && <div className="form-message">{message}</div>}<div className="settings-actions"><Button type="submit" loading={busy}><Settings size={18}/> Save settings</Button></div></form>}</section>
}

export function NotificationsView({ context }: { context: BusinessContext }) {
  const products = useProducts(context)
  const alerts = (products.data ?? []).filter((product) => Number(product.inventory_balances[0]?.confirmed_quantity ?? 0) <= Number(product.minimum_stock))
  return <section><div className="dashboard-title"><div><span className="eyebrow">Live stock alerts</span><h1>Notifications</h1><p>Calculated from current confirmed inventory.</p></div></div>{alerts.length ? <div className="notification-list">{alerts.map((product) => { const stock = Number(product.inventory_balances[0]?.confirmed_quantity ?? 0); return <article key={product.id}><span><Bell/></span><div><b>{stock <= 0 ? `${product.name} is out of stock` : `${product.name} is low on stock`}</b><p>Confirmed quantity: {stock} · Alert threshold: {product.minimum_stock}</p></div></article>})}</div> : !products.isLoading && <Empty icon={Bell} title="You’re all caught up" copy="No products are currently at or below their configured threshold." />}</section>
}
