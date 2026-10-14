import { useEffect, useRef, useState } from "react"
import { Camera, ScanLine, Smartphone, X } from "lucide-react"
import { Button } from "@/components/ui"

export type BarcodeScanResult = {
  name: string
  barcode: string
  imageUrl?: string | null
  detail?: string
  value?: string
  status?: "existing" | "new"
}

type ScannerControls = { stop: () => void }
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[]
}) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

export default function BarcodeScanner({
  onDetected,
  compact = false,
}: {
  onDetected: (barcode: string) => BarcodeScanResult | void | Promise<BarcodeScanResult | void>
  compact?: boolean
}) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [message, setMessage] = useState("Scanner ready")
  const [scanResult, setScanResult] = useState<BarcodeScanResult | null>(null)
  const [mobileDevice, setMobileDevice] = useState(() =>
    window.matchMedia("(max-width: 1024px) and (pointer: coarse)").matches,
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastScan = useRef({ value: "", at: 0 })
  const completedScan = useRef("")
  const processing = useRef(false)

  async function emit(value: string) {
    const barcode = value.trim()
    const now = Date.now()
    if (!barcode || processing.current || completedScan.current === barcode || (lastScan.current.value === barcode && now - lastScan.current.at < 1200)) return
    lastScan.current = { value: barcode, at: now }
    processing.current = true
    setScanResult(null)
    setMessage("Barcode detected. Loading product information…")
    try {
      const result = await onDetected(barcode)
      if (result) {
        completedScan.current = barcode
        setScanResult(result)
      }
      setMessage(result ? "Scan successful" : `Scanned ${barcode}`)
    } finally {
      processing.current = false
    }
  }

  useEffect(() => {
    const media = window.matchMedia(
      "(max-width: 1024px) and (pointer: coarse)",
    )
    const update = () => setMobileDevice(media.matches)
    media.addEventListener("change", update)
    return () => {
      media.removeEventListener("change", update)
    }
  }, [])

  useEffect(() => {
    if (!mobileDevice || !cameraOpen || !videoRef.current) return
    let active = true
    let stream: MediaStream | null = null
    let controls: ScannerControls | null = null
    let frame = 0

    async function start() {
      const video = videoRef.current
      if (!video) return
      try {
        const Detector = (
          window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
          })
          video.srcObject = stream
          await video.play()
          const detector = new Detector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
          })
          const scan = async () => {
            if (!active) return
            try {
              const results = await detector.detect(video)
              if (results[0]?.rawValue) emit(results[0].rawValue)
            } catch {
              // Individual camera frames can fail while autofocus settles.
            }
            frame = requestAnimationFrame(scan)
          }
          scan()
          setMessage("Point the camera at a barcode")
          return
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser")
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result) emit(result.getText())
        })
        setMessage("Point the camera at a barcode")
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Camera scanning is unavailable on this device.",
        )
      }
    }
    start()
    return () => {
      active = false
      cancelAnimationFrame(frame)
      controls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [cameraOpen, mobileDevice])

  if (!mobileDevice) {
    return (
      <div
        className={compact ? "mobile-scan-notice compact" : "mobile-scan-notice"}
        aria-label="Mobile camera scanning. Open SmartPOS on a phone to scan product barcodes."
        title="Open SmartPOS on a phone to scan product barcodes"
      >
        <Smartphone />
        <span>Barcode scanner</span>
      </div>
    )
  }

  return (
    <div className={compact ? "barcode-scanner compact" : "barcode-scanner"}>
      <div className="scanner-status">
        <span><ScanLine /></span>
        <div><b>Barcode scanner</b><small>{message}</small></div>
      </div>
      <Button variant="secondary" onClick={() => { completedScan.current = ""; setScanResult(null); setMessage("Scanner ready"); setCameraOpen(true) }}>
        <Camera size={17} /> Scan with camera
      </Button>
      {cameraOpen && (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Barcode camera scanner">
          <div className="camera-dialog">
            <div className="camera-heading"><div><ScanLine /><b>Scan barcode</b></div><Button variant="ghost" aria-label="Close camera" onClick={() => setCameraOpen(false)}><X /></Button></div>
            <div className="camera-viewport"><video ref={videoRef} muted playsInline /><span /></div>
            <p>{message}</p>
            {scanResult && <article className="scanner-product-result">
              {scanResult.imageUrl ? <img src={scanResult.imageUrl} alt={`${scanResult.name} package`} /> : <span className="scanner-product-placeholder"><ScanLine /></span>}
              <div><span className={`scanner-result-status ${scanResult.status ?? "existing"}`}>{scanResult.status === "new" ? "New product" : "In inventory"}</span><b>{scanResult.name}</b><small>Barcode: {scanResult.barcode}</small>{scanResult.detail && <small>{scanResult.detail}</small>}{scanResult.value && <strong>{scanResult.value}</strong>}<Button variant="secondary" onClick={() => { completedScan.current = ""; lastScan.current = { value: "", at: 0 }; setScanResult(null); setMessage("Point the camera at a barcode") }}><ScanLine size={15} /> Scan another product</Button></div>
            </article>}
          </div>
        </div>
      )}
    </div>
  )
}
