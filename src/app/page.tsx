"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { RatesService, RatesData } from "@/services/rates"
import { calculateRate, formatRate, getRateDecimals } from "@/lib/rates-utils"
import Link from "next/link"
import { CURRENCY_LABELS, SUPPORTED_REGIONS } from "@/lib/constants"

export default function Home() {
  const [rates, setRates] = useState<RatesData | null>(null)
  const [amountInput, setAmountInput] = useState<string>("100")
  const amountSent = parseFloat(amountInput) || 0
  const [sourceCurrency, setSourceCurrency] = useState<string>("PERU")
  const [targetCurrency, setTargetCurrency] = useState<string>("VES")
  const [amountReceived, setAmountReceived] = useState<string>("0")

  // Load latest rates
  useEffect(() => {
    const loadRates = async () => {
      const data = await RatesService.getLatest()
      if (data) setRates(data)
    }
    loadRates()
  }, [])

  // Calculate based on which input changed
  const updateCalculation = (value: string, direction: 'sent' | 'received') => {
    if (!rates) return

    const getPrice = (code: string) => {
      const key = code === 'VES' ? 'VENEZUELA' : code
      return rates.usdt_prices[key as keyof typeof rates.usdt_prices] || 0
    }

    const sourcePrice = getPrice(sourceCurrency)
    const targetPrice = getPrice(targetCurrency)

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
    } else {
      // Clean non-numeric characters for received input (e.g. from copy-paste)
      const cleanValue = value.replace(/[^0-9.,]/g, '').replace(',', '.')
      setAmountReceived(value)
      const amountRec = parseFloat(cleanValue) || 0
      const result = rate > 0 ? amountRec / rate : 0
      setAmountInput(result.toFixed(2))
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
    const sourceShort = sourceCurrency === 'VENEZUELA' ? 'VES' : (sourceCurrency === 'PERU' ? 'PEN' : (sourceCurrency === 'CHILE' ? 'CLP' : (sourceCurrency === 'COLOMBIA' ? 'COP' : 'USD')))
    const targetShort = targetCurrency === 'VENEZUELA' ? 'VES' : (targetCurrency === 'PERU' ? 'PEN' : (targetCurrency === 'CHILE' ? 'CLP' : (targetCurrency === 'COLOMBIA' ? 'COP' : 'USD')))

    return `1 ${sourceShort} = ${formatRate(rate, targetCurrency, sourceCurrency)} ${targetShort}`
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-2xl text-primary">Venecambio</div>
          <nav className="hidden md:flex gap-6">
            <a
              href="https://wa.me/584227173725"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:text-primary flex items-center gap-2"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-green-600"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-12.2 8.38 8.38 0 0 1 3.8.9L21 3z"></path>
              </svg>
              Contacto
            </a>
          </nav>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-24 lg:py-32 bg-secondary/30">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
                Envía dinero entre <span className="text-primary">Perú, Chile, Colombia, USA y Venezuela</span>
              </h1>
              <p className="text-muted-foreground text-xl">
                Tus remesas llegan al instante. La mejor tasa del mercado garantizada.
              </p>
              <div className="flex gap-4">
                <Button size="lg">Calcular Envío</Button>
              </div>
            </div>

            <Card className="w-full max-w-md mx-auto shadow-lg border-2">
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

                <div className="pt-2 border-t text-sm flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Tasa de cambio:</span>
                  <span className="font-bold text-primary">{getActiveRate()}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full text-lg" size="lg">Enviar Ahora</Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          © 2024 Venecambio. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}

