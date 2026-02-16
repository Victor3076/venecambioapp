import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
    className?: string
    showText?: boolean
    variant?: 'light' | 'dark' | 'primary'
    collapsed?: boolean
}

export function Logo({ className, showText = true, variant = 'primary', collapsed = false }: LogoProps) {
    // Colors based on variant
    const textColors = {
        primary: 'text-primary',
        light: 'text-white',
        dark: 'text-foreground'
    }

    return (
        <Link href="/" className={cn("flex items-center gap-2 group transition-all", className)}>
            {/* Logo Icon Container */}
            <div className={cn(
                "relative flex items-center justify-center transition-transform group-hover:scale-105",
                collapsed ? "w-10 h-10" : "w-8 h-8"
            )}>
                <Image
                    src="/logo.png"
                    alt="Venecambio Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                    priority
                />
            </div>

            {showText && !collapsed && (
                <span className={cn(
                    "font-bold text-xl tracking-tight",
                    textColors[variant]
                )}>
                    Venecambio
                </span>
            )}
        </Link>
    )
}
