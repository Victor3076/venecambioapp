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

    const setupWebFcm = async (userId: string) => {
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
                await saveTokenToSupabase(token, 'web', userId)
            }

            onMessage(messaging, (payload) => {
                console.log("Web message received in foreground:", payload)
            })
        } catch (error) {
            console.error("Error setting up Web FCM:", error)
        }
    }

    const saveTokenToSupabase = async (token: string, platform: string, userId: string) => {
        console.log(`Saving ${platform} token to database...`)

        // Upsert into fcm_tokens table
        const { error } = await supabase
            .from('fcm_tokens')
            .upsert({
                token: token,
                user_id: userId,
                platform: platform,
                last_active: new Date().toISOString()
            }, { onConflict: 'token' })

        if (error) console.error("Error saving FCM token:", error)
    }

    const setupNativeFcm = async (userId: string) => {
        try {
            console.log("Native: Checking permissions...")
            let permStatus = await PushNotifications.checkPermissions()

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') {
                console.log("Native notification permission NOT granted")
                return
            }

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
        } catch (error) {
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
            setShowPermissionButton(false)
            const { data: { user } } = await supabase.auth.getUser()
            if (user) await setupWebFcm(user.id)
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
