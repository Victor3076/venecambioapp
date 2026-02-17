"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RatesService, RatesData } from "@/services/rates"
import { AdminSettingsService, AdminSettings } from "@/services/admin-settings"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import Link from "next/link"
import { CURRENCY_LABELS, SUPPORTED_REGIONS, MINIMUM_AMOUNTS } from "@/lib/constants"
import { Logo } from "@/components/logo"
import { AlertCircle, Clock } from "lucide-react"

export default function Home() {
  const [rates, setRates] = useState<RatesData | null>(null)
  const [amountInput, setAmountInput] = useState<string>("100")
  const amountSent = parseFloat(amountInput) || 0
  const [sourceCurrency, setSourceCurrency] = useState<string>("PERU")
  const [targetCurrency, setTargetCurrency] = useState<string>("VES")
  const [amountReceived, setAmountReceived] = useState<string>("0")
  const [amountBcv, setAmountBcv] = useState<string>("0")
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null)

  const minAmount = MINIMUM_AMOUNTS[sourceCurrency] || 0
  const isBelowMin = amountSent < minAmount

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      const [ratesData, settingsData] = await Promise.all([
        RatesService.getLatest(),
        AdminSettingsService.getSettings()
      ])
      if (ratesData) setRates(ratesData)
      if (settingsData) setAdminSettings(settingsData)
    }
    loadData()
  }, [])

  // Calculate based on which input changed
  const updateCalculation = (value: string, direction: 'sent' | 'received' | 'bcv') => {
    if (!rates) return

    const getPrice = (code: string) => {
      const key = code === 'VES' ? 'VENEZUELA' : code
      return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
    }

    const sourcePrice = getPrice(sourceCurrency)
    const targetPrice = getPrice(targetCurrency)
    const bcvRate = rates.usdt_prices.BCV || 1

    const marginKey = `${sourceCurrency}_${targetCurrency}`
    const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0

    const rawRate = calculateRate(targetCurrency, sourceCurrency, targetPrice, sourcePrice, margin)
    const decimals = getRateDecimals(targetCurrency, sourceCurrency)
    // IMPORTANT: Round rate to displayed precision for exact calculations
    const rate = Number(rawRate.toFixed(decimals))

    if (direction === 'sent') {
      const amount = parseFloat(value) || 0
      setAmountInput(value)
      const result = amount * rate
      setAmountReceived(formatRate(result, targetCurrency, sourceCurrency))
      // Update BCV if target is VES
      if (targetCurrency === 'VES') {
        setAmountBcv((result / bcvRate).toFixed(2))
      }
    } else if (direction === 'received') {
      // Clean non-numeric characters for received input (e.g. from copy-paste)
      const cleanValue = value.replace(/[^0-9.,]/g, '').replace(',', '.')
      setAmountReceived(value)
      const amountRec = parseFloat(cleanValue) || 0
      const result = rate > 0 ? amountRec / rate : 0
      setAmountInput(result.toFixed(2))
      // Update BCV if target is VES
      if (targetCurrency === 'VES') {
        setAmountBcv((amountRec / bcvRate).toFixed(2))
      }
    } else if (direction === 'bcv') {
      setAmountBcv(value)
      if (targetCurrency === 'VES') {
        const amountBcvVal = parseFloat(value) || 0
        const amountRec = amountBcvVal * bcvRate
        setAmountReceived(formatRate(amountRec, targetCurrency, sourceCurrency))
        const resultSent = rate > 0 ? amountRec / rate : 0
        setAmountInput(resultSent.toFixed(2))
      }
    }
  }

  // Effect to recalculate when currencies or rates change (keeping amount sent fixed)
  useEffect(() => {
    updateCalculation(amountInput, 'sent')
  }, [sourceCurrency, targetCurrency, rates])

  const getActiveRate = () => {
    if (!rates) return "Cargando..."

    const getPrice = (code: string) => {
      const key = code === 'VES' ? 'VENEZUELA' : code
      return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
    }

    const sourcePrice = getPrice(sourceCurrency)
    const targetPrice = getPrice(targetCurrency)

    const marginKey = `${sourceCurrency}_${targetCurrency}`
    const margin = rates.margins[marginKey] || rates.margins["GENERIC"] || 0
    const rate = calculateRate(targetCurrency, sourceCurrency, targetPrice, sourcePrice, margin)

    // Use short codes for the rate display ticker
    const sourceShort = sourceCurrency === 'USA' ? 'USD' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : (sourceCurrency === 'COLOMBIA' ? 'COP' : sourceCurrency)))
    const targetShort = targetCurrency === 'VES' ? 'VES' : (targetCurrency === 'USA' ? 'USD' : (targetCurrency === 'PERU' ? 'PEN' : (targetCurrency === 'CHILE' ? 'CLP' : (targetCurrency === 'COLOMBIA' ? 'COP' : targetCurrency))))

    return `1 ${sourceShort} = ${formatRate(rate, targetCurrency, sourceCurrency)} ${targetShort}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex gap-8">
            <a
              href="https://wa.me/584227173725"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-12.2 8.38 8.38 0 0 1 3.8.9L21 3z"></path>
                </svg>
              </div>
              Contacto WhatsApp
            </a>
          </nav>
          <div className="flex gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Ingresar</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Crear Cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden py-10 md:py-20 lg:py-28 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-background to-background">
          <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 max-w-2xl">
              <h1 className="text-balance text-[clamp(2rem,6vw,4rem)] font-extrabold tracking-tight leading-[1.1]">
                Envía dinero entre <br />
                <span className="text-primary bg-clip-text">Perú, Chile, Colombia, USA y Venezuela</span>
              </h1>
              <p className="text-muted-foreground text-lg md:text-xl max-w-[500px]">
                Envía tus remesas de forma **Rápida, Segura y con la mejor tasa** del mercado.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Button size="lg" disabled={isBelowMin || adminSettings?.is_open === false} asChild={!isBelowMin && adminSettings?.is_open !== false} className="px-8 h-12 text-base font-bold shadow-lg shadow-primary/25">
                  {adminSettings?.is_open === false ? "Cerrado" : (isBelowMin ? "Monto insuficiente" : <Link href="/login">Empezar ahora</Link>)}
                </Button>
                <Button size="lg" variant="outline" className="h-12 text-base" asChild>
                  <Link href="/register">Ver Tasas</Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              {!adminSettings?.is_open && adminSettings !== null && (
                <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center p-6 text-center animate-in fade-in duration-500">
                  <div className="bg-white shadow-2xl rounded-xl p-8 border border-red-100 max-w-sm space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Operaciones Cerradas</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {adminSettings.closed_message}
                    </p>
                    <Button variant="outline" className="w-full" asChild>
                      <a href="https://wa.me/584227173725" target="_blank" rel="noopener noreferrer">
                        Consultar por WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              <Card className="w-full max-w-md mx-auto shadow-2xl border-none ring-1 ring-black/5 bg-white/70 backdrop-blur-xl rounded-2xl overflow-hidden">
                <CardHeader>
                  <CardTitle>Calculadora de Envío</CardTitle>
                  <CardDescription>Cotiza tu envío en segundos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Envías</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="100"
                        value={amountInput}
                        onChange={(e) => updateCalculation(e.target.value, 'sent')}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className={isBelowMin ? "border-red-500" : ""}
                      />
                      <select
                        value={sourceCurrency}
                        onChange={(e) => setSourceCurrency(e.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {SUPPORTED_REGIONS.filter(r => r !== 'VENEZUELA').map(region => (
                          <option key={region} value={region}>
                            {CURRENCY_LABELS[region]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isBelowMin && (
                      <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        Monto mínimo: {minAmount} {sourceCurrency === 'USA' ? 'USD' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : 'COP'))}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reciben</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={amountReceived}
                        onChange={(e) => updateCalculation(e.target.value, 'received')}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        className="bg-background font-bold text-lg"
                      />
                      <select
                        value={targetCurrency}
                        onChange={(e) => setTargetCurrency(e.target.value)}
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {SUPPORTED_REGIONS.map(region => (
                          <option key={region} value={region === 'VENEZUELA' ? 'VES' : region}>
                            {CURRENCY_LABELS[region]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {targetCurrency === 'VES' && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <span className="bg-primary/10 text-primary p-1 rounded text-[10px] font-bold">BCV</span>
                        Equivale a:
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                          <Input
                            type="text"
                            value={amountBcv}
                            onChange={(e) => updateCalculation(e.target.value, 'bcv')}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="pl-7 bg-muted/30 font-bold border-primary/20"
                          />
                        </div>
                        <div className="w-[110px] h-10 rounded-md border border-input bg-muted/10 px-3 py-2 text-xs flex items-center justify-center font-bold text-muted-foreground uppercase">
                          Dólares
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic px-1">
                        * Referencia calculada a tasa oficial BCV ({rates?.usdt_prices.BCV})
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t text-sm flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Tasa de cambio:</span>
                    <span className="font-bold text-primary">{getActiveRate()}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full text-lg"
                    size="lg"
                    disabled={isBelowMin || adminSettings?.is_open === false}
                    asChild={!isBelowMin && adminSettings?.is_open !== false}
                  >
                    {adminSettings?.is_open === false ? "Fuera de Horario" : (isBelowMin ? "Monto insuficiente" : <Link href="/login">Enviar Ahora</Link>)}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          © 2026 Venecambio. Todos los derechos reservados.
        </div>
      </footer>
    </div >
  );
}

