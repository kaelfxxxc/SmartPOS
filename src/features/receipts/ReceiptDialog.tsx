import { CheckCircle2, Package, Printer, X } from "lucide-react"
import { Button } from "@/components/ui"
import { peso, type BusinessContext, type Product } from "@/features/workspace/types"

type ReceiptLine = { product: Product; quantity: number }
type Receipt = {
  receipt_number: string
  total_centavos: number
  change_centavos: number
  tendered_centavos: number
  completed_at: string
  lines: ReceiptLine[]
}

export default function ReceiptDialog({
  context,
  receipt,
  onClose,
}: {
  context: BusinessContext
  receipt: Receipt
  onClose: () => void
}) {
  const itemCount = receipt.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Internal sales receipt">
      <div className="receipt-shell">
        <section className="checkout-success" aria-labelledby="checkout-success-title">
          <CheckCircle2 />
          <div>
            <h2 id="checkout-success-title">Sale completed successfully</h2>
            <p>Inventory was updated and the purchased quantities were deducted.</p>
          </div>
        </section>
        <div className="checkout-success-products">
          {receipt.lines.map(({ product, quantity }) => (
            <article key={product.id}>
              {product.image_path ? <img src={product.image_path} alt="" /> : <span><Package /></span>}
              <div><b>{product.name}</b><small>{quantity} × {product.unit} checked out</small></div>
              <strong>{peso(product.price_centavos * quantity)}</strong>
            </article>
          ))}
        </div>
        <div className="receipt-actions">
          <Button variant="secondary" onClick={() => window.print()}><Printer size={17}/> Print receipt</Button>
          <Button variant="ghost" onClick={onClose}><X size={17}/> Close</Button>
        </div>
        <article className="print-receipt">
          <header><h1>{context.businessName}</h1><p>{context.branchName}</p><b>INTERNAL SALES RECORD</b><small>Not a BIR-authorized invoice</small></header>
          <dl><div><dt>Reference</dt><dd>{receipt.receipt_number}</dd></div><div><dt>Date</dt><dd>{new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(receipt.completed_at))}</dd></div><div><dt>Payment</dt><dd>Cash</dd></div></dl>
          <div className="receipt-lines"><div className="receipt-line-head"><span>Item</span><span>Qty</span><span>Amount</span></div>{receipt.lines.map(({product,quantity})=><div key={product.id}><span>{product.name}</span><span>{quantity}</span><span>{peso(product.price_centavos * quantity)}</span></div>)}</div>
          <dl className="receipt-totals"><div><dt>Total items</dt><dd>{itemCount}</dd></div><div><dt>Subtotal</dt><dd>{peso(receipt.total_centavos)}</dd></div><div className="receipt-grand"><dt>Total</dt><dd>{peso(receipt.total_centavos)}</dd></div><div><dt>Cash received</dt><dd>{peso(receipt.tendered_centavos)}</dd></div><div><dt>Change</dt><dd>{peso(receipt.change_centavos)}</dd></div></dl>
          <footer><b>THANK YOU!</b><span>Please come again</span></footer>
        </article>
      </div>
    </div>
  )
}
