"use client"

import { X } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

interface ImageModalProps {
    isOpen: boolean
    onClose: () => void
    imageUrl: string
    altText?: string
}

export function ImageModal({ isOpen, onClose, imageUrl, altText = "Comprobante" }: ImageModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEsc)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEsc)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center justify-center"
                onClick={e => e.stopPropagation()}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full"
                    onClick={onClose}
                >
                    <X className="w-6 h-6" />
                </Button>

                <div className="overflow-auto rounded-lg shadow-2xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageUrl}
                        alt={altText}
                        className="max-w-full max-h-[85vh] object-contain"
                    />
                </div>
            </div>
        </div>
    )
}
