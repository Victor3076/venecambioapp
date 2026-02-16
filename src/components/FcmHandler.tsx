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

                // 2. Get Token
                const vapidKey = "BNHpLPlpSVRXK73eeUBmIyEA7g1h-TNalsRUxav5N3ZVFd5a0B5CZx4CWhtGD-PzGWHAlKLbDMlmqZO4Ok3Xmj0"

                const token = await getToken(messaging, { vapidKey })

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
                    // You could show a toast here
                })

            } catch (error) {
                console.error("Error setting up FCM:", error)
            }
        }

        setupFcm()
    }, [])

    return null // This component doesn't render anything
}
