const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN

async function getGoogleAccessToken(): Promise<string> {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
        throw new Error('Las credenciales de Google Contacts no están configuradas en las variables de entorno.')
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: GOOGLE_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Error al refrescar el token de Google: ${res.statusText} - ${errorText}`)
    }

    const data = await res.json()
    return data.access_token as string
}

export async function getNextClientNumber(prefix: string): Promise<number> {
    const accessToken = await getGoogleAccessToken()
    
    const baseNumbers: Record<string, number> = {
        'VC': 4400,
        'CHI': 500,
        'US': 208,
        'VEN': 117,
        'EUR': 24,
        'COL': 200
    }

    const inicialesInput = prefix.toUpperCase()
    if (!baseNumbers[inicialesInput]) {
        throw new Error(`Iniciales no válidas: ${inicialesInput}`)
    }

    let ultimoNumero = baseNumbers[inicialesInput] - 1
    let pageToken: string | null = null

    do {
        const url = new URL('https://people.googleapis.com/v1/people/me/connections')
        url.searchParams.set('personFields', 'names')
        url.searchParams.set('pageSize', '1000')
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken)
        }

        const res = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            }
        })

        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Error al obtener contactos de Google: ${res.statusText} - ${errorText}`)
        }

        const connections = await res.json()
        if (connections.connections) {
            for (const person of connections.connections) {
                if (person.names && person.names.length > 0) {
                    const nombreCompleto = person.names[0].displayName
                    const regex = new RegExp(`^${inicialesInput}[^\\d]*?(\\d+)$`, 'i')
                    const match = nombreCompleto.match(regex)
                    if (match) {
                        const numeroActual = parseInt(match[1], 10)
                        if (numeroActual > ultimoNumero) {
                            ultimoNumero = numeroActual
                        }
                    }
                }
            }
        }
        pageToken = connections.nextPageToken || null
    } while (pageToken)

    return ultimoNumero + 1
}

export async function createGoogleContact(name: string, phone: string): Promise<any> {
    const accessToken = await getGoogleAccessToken()

    const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            names: [{ givenName: name }],
            phoneNumbers: [{ value: phone, type: 'mobile' }]
        })
    })

    if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Error al crear el contacto de Google: ${res.statusText} - ${errorText}`)
    }

    return await res.json()
}
