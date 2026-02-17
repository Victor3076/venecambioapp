"use client"

import { useEffect } from "react"
import { messaging, getToken, onMessage } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"
import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"

export function FcmHandler() {
    useEffect(() => {
        const setupFcm = async () => {
            const isNative = Capacitor.isNativePlatform()
            console.log("FCM Setup - Is Native:", isNative)

            try {
                if (isNative) {
                    console.log("Native: Checking permissions...")
                    // 1. Request Permission Natively
                    let permStatus = await PushNotifications.checkPermissions()
                    console.log("Native: Current permission status:", permStatus)

                    if (permStatus.receive === 'prompt') {
                        console.log("Native: Requesting permissions...")
                        permStatus = await PushNotifications.requestPermissions()
                        console.log("Native: After request, status:", permStatus)
                    }

                    if (permStatus.receive !== 'granted') {
                        console.log("Native notification permission NOT granted")
                        alert("Por favor habilita las notificaciones en la configuración de la app.")
                        return
                    }

                    console.log("Native: Registering for push...")
                    // 2. Register for notifications
                    await PushNotifications.register()

                    // 3. Listen for token
                    PushNotifications.addListener('registration', async (res: { value: string }) => {
                        const token = res.value
                        console.log("Native FCM Token obtained:", token)
                        await saveTokenToSupabase(token)
                    })

                    // 4. Listen for errors
                    PushNotifications.addListener('registrationError', (error: any) => {
                        console.error("Native registration error:", error)
                    })

                    // 5. Listen for foreground notifications
                    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
                        console.log("Native push received:", notification)
                    })
                } else if (messaging) {
                    // Web Implementation
                    const permission = await Notification.requestPermission()
                    if (permission !== 'granted') {
                        console.log("Web permission not granted for notifications")
                        return
                    }

                    if ('serviceWorker' in navigator) {
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
                            await saveTokenToSupabase(token)
                        }

                        onMessage(messaging, (payload) => {
                            console.log("Web message received in foreground:", payload)
                        })
                    }
                }
            } catch (error) {
                console.error("Error setting up FCM/Push:", error)
            }
        }

        const saveTokenToSupabase = async (token: string) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('profiles')
                    .update({ fcm_token: token })
                    .eq('id', user.id)
            }
        }

        setupFcm()

        return () => {
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners()
            }
        }
    }, [])

    return null
}
