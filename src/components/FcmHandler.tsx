"use client"

import { useEffect, useState, useRef } from "react"
import { messaging, getToken, onMessage } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { LocalNotifications } from "@capacitor/local-notifications"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { toast } from "sonner"

export function FcmHandler() {
    const [token, setToken] = useState<string | null>(null)
    const [showPermissionButton, setShowPermissionButton] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        // Pre-load audio for instant playback
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
            audioRef.current.volume = 0.9
            audioRef.current.load()
        }
    }, [])

    const playChimeSound = () => {
        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0
                audioRef.current.play().catch(e => {
                    console.warn("Chime playback was prevented by browser:", e)
                })
            }
        } catch (e) {
            console.warn("Error playing chime:", e)
        }
    }

    const setupWebFcm = async (userId: string) => {
        try {
            if (!messaging || !('serviceWorker' in navigator)) {
                console.log("Web FCM: Messaging not available or no service worker support.")
                return
            }
            console.log("Web FCM: Checking for existing service worker...")
            let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');

            if (!registration) {
                console.log("Web FCM: Registering service worker at root scope...")
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            }

            console.log("Web FCM: Service worker status:", registration.active ? 'active' : 'not active');

            const vapidKey = "BNHpLPlpSVRXK73eeUBmIyEA7g1h-TNalsRUxav5N3ZVFd5a0B5CZx4CWhtGD-PzGWHAlKLbDMlmqZO4Ok3Xmj0"

            if (!vapidKey) {
                console.error("Web FCM: VAPID key is missing (unexpected).")
                return
            }

            console.log("Web FCM: Getting token...")
            const currentToken = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: registration
            })

            if (currentToken) {
                console.log("Web FCM Token obtained:", currentToken)
                setToken(currentToken)
                await saveTokenToSupabase(currentToken, 'web', userId)
            } else {
                console.log("Web FCM: No registration token available.")
                setShowPermissionButton(true)
            }

            onMessage(messaging, (payload) => {
                console.log("Web message received in foreground:", payload)
                playChimeSound()

                const title = payload.notification?.title || payload.data?.title || 'VeneCambio'
                const body = payload.notification?.body || payload.data?.body || 'Nueva actualización en el sistema'

                toast.info(`🔔 ${title}`, {
                    description: body,
                    duration: 12000,
                    position: 'top-right'
                })
            })
        } catch (error: any) {
            console.error("Error setting up Web FCM:", error);
            if (error.message?.includes('Permission denied')) {
                setShowPermissionButton(true);
            }
        }
    }

    const saveTokenToSupabase = async (token: string, platform: string, userId: string) => {
        // Upsert into fcm_tokens table
        const { error } = await supabase
            .from('fcm_tokens')
            .upsert({
                token: token,
                user_id: userId,
                platform: platform,
                last_active: new Date().toISOString()
            }, { onConflict: 'token' })

        if (error) {
            console.error("Error saving FCM token:", error)
        }
    }

    const setupNativeFcm = async (userId: string) => {
        try {
            // 1. Create Android Notification Channel for loud alerts
            try {
                await PushNotifications.createChannel({
                    id: 'transactions_alert',
                    name: 'Alertas de Operaciones',
                    description: 'Notificaciones con sonido para nuevas operaciones',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'default'
                })
            } catch (chanErr) {
                console.warn("Could not create Android Notification Channel:", chanErr)
            }

            let permStatus = await PushNotifications.checkPermissions()

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') return

            await PushNotifications.register()

            PushNotifications.addListener('registration', async (res: { value: string }) => {
                const token = res.value
                console.log("Native FCM Token obtained:", token)
                await saveTokenToSupabase(token, Capacitor.getPlatform(), userId)
            })

            PushNotifications.addListener('registrationError', (error: any) => {
                console.error("Native registration error:", error)
            })

            PushNotifications.addListener('pushNotificationReceived', async (notification: any) => {
                console.log("Native push received in FOREGROUND:", notification)
                playChimeSound()

                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || "VeneCambio",
                            body: notification.body || "",
                            id: Math.floor(Math.random() * 1000000),
                            extra: notification.data,
                            smallIcon: 'ic_stat_name',
                            iconColor: '#eab308',
                            channelId: 'transactions_alert',
                            sound: 'default'
                        }
                    ]
                })
            })
        } catch (error: any) {
            console.error("Error setting up Native FCM:", error)
        }
    }

    useEffect(() => {
        let mounted = true

        const checkPermissionAndSetup = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const isNative = Capacitor.isNativePlatform()

            if (!isNative && typeof window !== 'undefined' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    setShowPermissionButton(true)
                } else if (Notification.permission === 'granted') {
                    await setupWebFcm(user.id)
                }
            } else if (isNative) {
                await setupNativeFcm(user.id)
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && mounted) {
                checkPermissionAndSetup()
            } else if (!session?.user && event === 'SIGNED_OUT') {
                setToken(null)
            }
        })

        checkPermissionAndSetup()

        return () => {
            mounted = false
            subscription.unsubscribe()
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners()
            }
        }
    }, [])

    const handleManualPermissionRequest = async () => {
        if (!('Notification' in window)) return
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await setupWebFcm(user.id)
                setShowPermissionButton(false)
            }
        }
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
            {showPermissionButton && (
                <div className="bg-background border p-4 rounded-lg shadow-lg max-w-sm pointer-events-auto animate-in slide-in-from-bottom-5">
                    <h3 className="font-bold mb-2">Activar Notificaciones</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Recibe alertas inmediatas con sonido cuando se carguen operaciones.
                    </p>
                    <button
                        onClick={handleManualPermissionRequest}
                        className="w-full shadow-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                    >
                        <Bell className="w-4 h-4" /> Activar Ahora
                    </button>
                    <div className="mt-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setShowPermissionButton(false)} className="text-xs h-6">
                            Ahora no
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
