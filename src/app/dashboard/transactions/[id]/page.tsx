import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, FileText, Download, Share2 } from "lucide-react"

export default function TransactionDetailsPage({ params }: { params: { id: string } }) {
    // This would typically fetch data based on params.id
    const status = "Completado" // Verificando, Verificado, Completado

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">Detalle de Operación</h1>
                    <p className="text-muted-foreground">ID: #{params.id || "12345"}</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Estado del Envío</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative pl-6 border-l-2 border-muted space-y-8">
                            <div className="relative">
                                <div className="absolute -left-[31px] bg-background p-1">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Operación Recibida</p>
                                    <p className="text-xs text-muted-foreground">10 Feb, 10:30 AM</p>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[31px] bg-background p-1">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Verificando Pago</p>
                                    <p className="text-xs text-muted-foreground">10 Feb, 10:35 AM</p>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[31px] bg-background p-1">
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">Pago Verificado</p>
                                    <p className="text-xs text-muted-foreground">10 Feb, 10:45 AM</p>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[31px] bg-background p-1">
                                    {status === "Completado" ? (
                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <Clock className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div>
                                    <p className={`font-medium text-sm ${status === "Completado" ? "" : "text-muted-foreground"}`}>
                                        Envío Completado
                                    </p>
                                    {status === "Completado" && (
                                        <p className="text-xs text-muted-foreground">10 Feb, 11:00 AM</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resumen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Enviaste:</span>
                            <span className="font-medium">100.00 USD</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tasa:</span>
                            <span className="font-medium">36.50 VES/USD</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                            <span className="text-muted-foreground">Recibió:</span>
                            <span className="font-bold text-lg">3,650.00 VES</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Beneficiario:</span>
                            <span className="font-medium">María Gomez (Banesco)</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Comprobante de Pago</CardTitle>
                        <CardDescription>Documento adjunto por Venecambio</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex items-center justify-center bg-muted/20 m-6 rounded-lg border-2 border-dashed">
                        {status === "Completado" ? (
                            <div className="text-center p-8">
                                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                                <p className="text-sm font-medium">Comprobante_12345.pdf</p>
                                <p className="text-xs text-muted-foreground">Click para previsualizar</p>
                            </div>
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                <Clock className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-sm">El comprobante estará disponible al completar la operación.</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button className="w-full" variant="outline" disabled={status !== "Completado"}>
                            <Download className="mr-2 h-4 w-4" /> Descargar
                        </Button>
                        <Button className="w-full" disabled={status !== "Completado"}>
                            <Share2 className="mr-2 h-4 w-4" /> Compartir
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
