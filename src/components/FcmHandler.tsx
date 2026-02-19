"use client"

import { useEffect, useState } from "react"
import { messaging, getToken, onMessage } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import { LocalNotifications } from "@capacitor/local-notifications"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"

export function FcmHandler() {
    const [token, setToken] = useState<string | null>(null)
    const [showPermissionButton, setShowPermissionButton] = useState(false)

    const setupWebFcm = async (userId: string) => {
        try {
            if (!messaging || !('serviceWorker' in navigator)) {
                console.log("Web FCM: Messaging not available or no service worker support.")
                return
            }
            console.log("Web FCM: Registering service worker...")
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=2', {
                scope: '/firebase-cloud-messaging-push-scope',
            });
            console.log("Web FCM: Service worker registered.")

            // Hardcoded key to ensure it works in PWA/Prod without env var issues
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
            })
        } catch (error: any) {
            console.error("Error setting up Web FCM:", error)
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
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || "Venecambio",
                            body: notification.body || "",
                            id: Math.floor(Math.random() * 1000000),
                            extra: notification.data,
                            smallIcon: 'ic_stat_name',
                            iconColor: '#eab308'
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
                        Recibe actualizaciones sobre tus operaciones al instante.
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
