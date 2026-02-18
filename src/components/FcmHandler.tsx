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
    const [showPermissionButton, setShowPermissionButton] = useState(false)

    useEffect(() => {
        const checkPermissionAndSetup = async () => {
            const isNative = Capacitor.isNativePlatform()

            if (!isNative && typeof window !== 'undefined' && 'Notification' in window) {
                // WEB / PWA Logic
                if (Notification.permission === 'default') {
                    // We need to ask for permission manually (required for iOS)
                    setShowPermissionButton(true)
                } else if (Notification.permission === 'granted') {
                    // Already granted, proceed to setup
                    await setupWebFcm()
                }
            } else if (isNative) {
                // NATIVE Logic
                await setupNativeFcm()
            }
        }

        checkPermissionAndSetup()

        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners()
            }
        }
    }, [])

    const setupNativeFcm = async () => {
        try {
            console.log("Native: Checking permissions...")
            // 1. Request Permission Natively
            let permStatus = await PushNotifications.checkPermissions()

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') {
                console.log("Native notification permission NOT granted")
                return
            }

            // 2. Register for notifications
            await PushNotifications.register()

            // 3. Listen for token
            PushNotifications.addListener('registration', async (res: { value: string }) => {
                const token = res.value
                console.log("Native FCM Token obtained:", token)
                await saveTokenToSupabase(token, Capacitor.getPlatform())
            })

            // 4. Listen for errors
            PushNotifications.addListener('registrationError', (error: any) => {
                console.error("Native registration error:", error)
            })

            // 5. Listen for foreground notifications
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
        } catch (error) {
            console.error("Error setting up Native FCM:", error)
        }
    }

    const setupWebFcm = async () => {
        try {
            if (!messaging || !('serviceWorker' in navigator)) return

            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/firebase-cloud-messaging-push-scope',
            });

            const vapidKey = "BNHpLPlpSVRXK73eeUBmIyEA7g1h-TNalsRUxav5N3ZVFd5a0B5CZx4CWhtGD-PzGWHAlKLbDMlmqZO4Ok3Xmj0"
            const token = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: registration
            })

            if (token) {
                console.log("Web FCM Token obtained:", token)
                await saveTokenToSupabase(token, 'web')
            }

            onMessage(messaging, (payload) => {
                console.log("Web message received in foreground:", payload)
                // Optional: Show toast here
            })
        } catch (error) {
            console.error("Error setting up Web FCM:", error)
        }
    }

    const saveTokenToSupabase = async (token: string, platform: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            console.log(`Saving ${platform} token to database...`)
            await supabase
                .from('profiles')
                .update({
                    fcm_token: token,
                    fcm_platform: platform
                })
                .eq('id', user.id)
        }
    }

    const handleManualPermissionRequest = async () => {
        if (!('Notification' in window)) return

        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
            setShowPermissionButton(false)
            await setupWebFcm()
        }
    }

    if (!showPermissionButton) return null

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:bottom-8 md:right-8 md:left-auto md:w-auto animate-in slide-in-from-bottom-5 fade-in duration-500">
            <Button
                onClick={handleManualPermissionRequest}
                className="w-full md:w-auto shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 rounded-xl flex items-center gap-3 border-2 border-primary-foreground/20"
            >
                <div className="bg-white/20 p-2 rounded-full">
                    <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div className="text-left">
                    <p className="text-sm leading-none">Activar Notificaciones</p>
                    <p className="text-[10px] opacity-90 font-normal mt-1">Recibe alertas del estado de tu envío</p>
                </div>
            </Button>
        </div>
    )
}
