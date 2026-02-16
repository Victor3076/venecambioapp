"use client"

import { useEffect } from "react"
import { messaging, getToken, onMessage } from "@/lib/firebase"
import { supabase } from "@/lib/supabase"

export function FcmHandler() {
    useEffect(() => {
        const setupFcm = async () => {
            if (!messaging) return

            try {
                // 1. Request Permission
                const permission = await Notification.requestPermission()
                if (permission !== 'granted') {
                    console.log("Permission not granted for notifications")
                    return
                }

                // 2. Register Service Worker manually for Next.js consistency
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
                        console.log("FCM Token obtained:", token)

                        // 3. Save to Supabase
                        const { data: { user } } = await supabase.auth.getUser()
                        if (user) {
                            await supabase
                                .from('profiles')
                                .update({ fcm_token: token })
                                .eq('id', user.id)
                        }
                    }

                    // 4. Listen for foreground messages
                    onMessage(messaging, (payload) => {
                        console.log("Message received in foreground:", payload)
                    })
                }
            } catch (error) {
                console.error("Error setting up FCM:", error)
            }
        }

        setupFcm()
    }, [])

    return null // This component doesn't render anything
}
