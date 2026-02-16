import { TransactionsService } from "@/services/transactions"
import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, Landmark, User, Clock, XCircle } from "lucide-react"

interface PageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params
    const tx = await TransactionsService.getPublicById(id)

    if (!tx || !tx.completion_proof_url) {
        return {
            title: "Operación de Venecambio",
            description: "Detalle de operación en Venecambio."
        }
    }

    return {
        title: `Comprobante ${tx.amount_received.toLocaleString()} ${tx.currency_received} - Venecambio`,
        description: `Operación finalizada el ${tx.updated_at ? new Date(tx.updated_at).toLocaleDateString() : 'recientemente'}.`,
        openGraph: {
            title: `Recibo de Pago - Venecambio`,
            description: `Se ha enviado ${tx.amount_sent} ${tx.currency_sent} para recibir ${tx.amount_received.toLocaleString()} ${tx.currency_received}.`,
            images: [
                {
                    url: tx.completion_proof_url,
                    width: 800,
                    height: 1000,
                    alt: 'Comprobante de Pago Venecambio',
                }
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: `Recibo de Pago - Venecambio`,
            description: `Operación de transferencia internacional finalizada.`,
            images: [tx.completion_proof_url],
        }
    }
}

export default async function PublicReceiptPage({ params }: PageProps) {
    const { id } = await params
    const tx = await TransactionsService.getPublicById(id)

    if (!tx) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
                <Card className="w-full max-w-md text-center p-8">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold">Operación no encontrada</h1>
                    <p className="text-muted-foreground mt-2">El enlace es inválido o la operación ha sido removida.</p>
                </Card>
            </div>
        )
    }

    const statusConfig = {
        verifying: { label: 'En Verificación', color: 'text-yellow-600', icon: Clock },
        verified: { label: 'Fondos Verificados', color: 'text-blue-600', icon: Clock },
        completed: { label: 'Operación Completada', color: 'text-green-600', icon: CheckCircle2 },
        rejected: { label: 'Operación Rechazada', color: 'text-red-600', icon: XCircle },
    }

    const config = statusConfig[tx.status] || statusConfig.verifying
    const StatusIcon = config.icon

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <div className="text-2xl font-black tracking-tighter text-primary inline-flex items-center gap-2">
                        VENECAMBIO
                    </div>
                    <p className="text-sm text-muted-foreground uppercase tracking-widest mt-1">Recibo de Operación</p>
                </div>

                <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
                    <CardHeader className="bg-white pb-2 flex flex-col items-center border-b border-dashed">
                        <div className={`p-3 rounded-full bg-muted/30 ${config.color} mb-2`}>
                            <StatusIcon className="w-8 h-8" />
                        </div>
                        <CardTitle className="text-2xl text-center">{config.label}</CardTitle>
                        <CardDescription className="text-center">Ref: {tx.id?.split('-')[0]}</CardDescription>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="p-6 md:p-8 bg-white space-y-8">
                            {/* Amounts Section */}
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Monto Enviado</p>
                                    <p className="text-xl font-bold">{tx.amount_sent} {tx.currency_sent}</p>
                                </div>
                                <div className="space-y-1 border-l">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Monto Recibido</p>
                                    <p className="text-xl font-bold text-primary">{tx.amount_received.toLocaleString()} {tx.currency_received}</p>
                                </div>
                            </div>

                            {/* Details List */}
                            <div className="space-y-4 pt-4">
                                {tx.beneficiary_data && (
                                    <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                        <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Beneficiario</p>
                                            <p className="font-bold">{tx.beneficiary_data.alias}</p>
                                            <p className="text-sm text-muted-foreground">{tx.beneficiary_data.bank_name}</p>
                                            <p className="text-xs font-mono text-muted-foreground mt-1">{tx.beneficiary_data.account_number}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                    <Landmark className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Detalles de Tasas</p>
                                        <div className="flex justify-between text-sm">
                                            <span>Tasa de cambio</span>
                                            <span className="font-bold">{tx.exchange_rate}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/20">
                                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Fecha y Hora</p>
                                        <p className="text-sm">
                                            {tx.created_at ? new Date(tx.created_at).toLocaleString('es-VE') : 'No disponible'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Public proof view button if mobile */}
                            {tx.completion_proof_url && (
                                <div className="pt-6">
                                    <a
                                        href={tx.completion_proof_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block w-full text-center py-4 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg hover:brightness-110 transition-all uppercase tracking-wider text-sm"
                                    >
                                        Ver Comprobante Original
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Footer styling */}
                        <div className="p-6 bg-muted/10 border-t border-dashed text-center">
                            <p className="text-[10px] text-muted-foreground uppercase leading-relaxed">
                                Este es un comprobante digital generado por Venecambio.<br />
                                Para consultas o soporte, contáctenos citando la referencia {tx.id}.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground mt-8">
                    &copy; {new Date().getFullYear()} Venecambio - Pasión por conectar familias.
                </p>
            </div>
        </div>
    )
}
