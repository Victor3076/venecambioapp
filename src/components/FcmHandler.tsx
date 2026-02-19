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
    const [logs, setLogs] = useState<string[]>([])

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
    }

    const setupWebFcm = async (userId: string) => {
        try {
            if (!messaging || !('serviceWorker' in navigator)) {
                addLog("Web FCM: Messaging not available or no service worker support.")
                return
            }
            addLog("Web FCM: Registering service worker...")
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/firebase-cloud-messaging-push-scope',
            });
            addLog("Web FCM: Service worker registered.")

            // Hardcoded key to ensure it works in PWA/Prod without env var issues
            const vapidKey = "BNHpLPlpSVRXK73eeUBmIyEA7g1h-TNalsRUxav5N3ZVFd5a0B5CZx4CWhtGD-PzGWHAlKLbDMlmqZO4Ok3Xmj0"

            if (!vapidKey) {
                addLog("Web FCM: VAPID key is missing (unexpected).")
                return
            }

            addLog("Web FCM: Getting token...")
            const currentToken = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: registration
            })

            if (currentToken) {
                addLog("Web FCM Token obtained!")
                setToken(currentToken)
                await saveTokenToSupabase(currentToken, 'web', userId)
            } else {
                addLog("Web FCM: No registration token available.")
                setShowPermissionButton(true)
            }

            onMessage(messaging, (payload) => {
                addLog(`Web message received in foreground: ${payload.notification?.title || 'No Title'}`)
                console.log("Web message received in foreground:", payload)
            })
        } catch (error: any) {
            addLog(`Error setting up Web FCM: ${error.message}`)
            console.error("Error setting up Web FCM:", error)
        }
    }

    const saveTokenToSupabase = async (token: string, platform: string, userId: string) => {
        addLog(`Saving ${platform} token to database...`)

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
            addLog(`Error saving FCM token: ${error.message}`)
            console.error("Error saving FCM token:", error)
        } else {
            addLog(`${platform} token saved successfully.`)
        }
    }

    const setupNativeFcm = async (userId: string) => {
        try {
            addLog("Native: Checking permissions...")
            let permStatus = await PushNotifications.checkPermissions()

            if (permStatus.receive === 'prompt') {
                addLog("Native: Permission status is 'prompt', requesting permissions...")
                permStatus = await PushNotifications.requestPermissions()
            }

            if (permStatus.receive !== 'granted') {
                addLog("Native notification permission NOT granted")
                return
            }
            addLog("Native: Notification permission granted.")

            addLog("Native: Registering for push notifications...")
            await PushNotifications.register()
            addLog("Native: PushNotifications.register() called.")

            PushNotifications.addListener('registration', async (res: { value: string }) => {
                const token = res.value
                addLog(`Native FCM Token obtained: ${token}`)
                await saveTokenToSupabase(token, Capacitor.getPlatform(), userId)
            })

            PushNotifications.addListener('registrationError', (error: any) => {
                addLog(`Native registration error: ${error.error.message}`)
                console.error("Native registration error:", error)
            })

            PushNotifications.addListener('pushNotificationReceived', async (notification: any) => {
                addLog(`Native push received in FOREGROUND: ${notification.title || 'No Title'}`)
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
            addLog(`Error setting up Native FCM: ${error.message}`)
            console.error("Error setting up Native FCM:", error)
        }
    }

    useEffect(() => {
        let mounted = true

        const checkPermissionAndSetup = async () => {
            addLog("CheckPermissionAndSetup initiated")
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                addLog("No user found in getUser()")
                return
            }
            addLog(`User found: ${user.email} (ID: ${user.id})`)

            const isNative = Capacitor.isNativePlatform()
            addLog(`Platform: ${isNative ? 'Native' : 'Web/PWA'}`)

            if (!isNative && typeof window !== 'undefined' && 'Notification' in window) {
                const currentPerm = Notification.permission
                addLog(`Web: Notification.permission = '${currentPerm}'`)
                addLog(`Type of permission: ${typeof currentPerm}`)
                addLog(`Comparison 'granted' === '${currentPerm}': ${currentPerm === 'granted'}`)

                if (currentPerm === 'default') {
                    addLog("Permission default, showing button")
                    setShowPermissionButton(true)
                } else if (currentPerm === 'granted') {
                    addLog("Permission IS granted. Calling setupWebFcm...")
                    await setupWebFcm(user.id)
                } else {
                    addLog(`Permission denied/other: ${currentPerm}`)
                }
            } else if (isNative) {
                addLog("Setting up Native FCM")
                await setupNativeFcm(user.id)
            } else {
                addLog("Notifications not supported in this environment.")
            }
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            addLog(`Auth Event: ${event}`)
            if (session?.user && mounted) {
                checkPermissionAndSetup()
            } else if (!session?.user && event === 'SIGNED_OUT') {
                addLog("User signed out, clearing token.")
                setToken(null)
            }
        })

        checkPermissionAndSetup()

        return () => {
            mounted = false
            subscription.unsubscribe()
            if (Capacitor.isNativePlatform()) {
                PushNotifications.removeAllListeners()
                addLog("Native: PushNotifications listeners removed.")
            }
            addLog("Cleanup complete.")
        }
    }, [])

    const handleManualPermissionRequest = async () => {
        if (!('Notification' in window)) {
            addLog("Manual request: Notification API not supported.")
            return
        }
        addLog("Manual request: Requesting notification permission...")
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
            addLog("Permission granted manually")
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await setupWebFcm(user.id)
                setShowPermissionButton(false)
            } else {
                addLog("Manual request: No user found after permission granted.")
            }
        } else {
            addLog(`Permission denied manually: ${permission}`)
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

            {/* DEBUG CONSOLE - REMOVE BEFORE PROD */}
            {logs.length > 0 && (
                <div className="bg-black/80 text-white p-2 rounded text-[10px] max-w-[300px] max-h-[200px] overflow-y-auto pointer-events-auto">
                    <div className="flex justify-between border-b border-white/20 pb-1 mb-1">
                        <strong>Debug Logs</strong>
                        <div className="flex gap-2">
                            <button onClick={() => setLogs([])} className="text-red-300 hover:text-red-100">Clear</button>
                            <button onClick={() => window.location.reload()} className="text-blue-300 hover:text-blue-100">Reload</button>
                            <button onClick={async () => {
                                addLog("Forcing SetupWebFcm...")
                                const { data } = await supabase.auth.getUser()
                                if (data.user) await setupWebFcm(data.user.id)
                                else addLog("No user for force setup")
                            }} className="text-yellow-300 hover:text-yellow-100">Force</button>
                        </div>
                    </div>
                    {logs.map((log, i) => (
                        <div key={i} className="font-mono">{log}</div>
                    ))}
                </div>
            )}
        </div>
    )
}

