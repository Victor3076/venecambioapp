"use client"

import Link from "next/link"
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
            <div className="relative w-8 h-8 flex items-center justify-center bg-primary rounded-lg shadow-md group-hover:scale-105 transition-transform overflow-hidden">
                {/* Fallback SVG Icon if no image */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-white"
                >
                    <path
                        d="M12 2L2 7L12 12L22 7L12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M2 17L12 22L22 17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M2 12L12 17L22 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            {showText && (
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
