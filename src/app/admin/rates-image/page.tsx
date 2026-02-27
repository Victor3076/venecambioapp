
"use client"
import React from 'react';

export default function RatesImagePage() {
    const date = "27 de Febrero de 2026";
    const rates = {
        peru: "170,72",
        chile: "0,6462",
        colombia: "6,70",
        usa: "528,96"
    };

    return (
        <div style={{
            width: '1080px',
            height: '1920px',
            position: 'relative',
            backgroundImage: 'url(/tasas.png)',
            backgroundSize: '1080px 1920px',
            backgroundRepeat: 'no-repeat',
            fontFamily: 'sans-serif',
            color: 'white',
            fontWeight: '900'
        }}>
            {/* Header Date - In Black Box at the Top Right */}
            <div style={{
                position: 'absolute',
                top: '208px',
                left: '585px',
                fontSize: '32px',
                color: '#333',
                width: '325px',
                height: '55px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                letterSpacing: '1px'
            }}>
                {date}
            </div>

            {/* Peru - Venezuela - In Red Box Area */}
            <div style={{
                position: 'absolute',
                top: '298px',
                left: '632px',
                fontSize: '60px',
                color: 'white',
                width: '210px',
                height: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {rates.peru}
            </div>

            {/* Chile - Venezuela - In Blue Box Area */}
            <div style={{
                position: 'absolute',
                top: '402px',
                left: '632px',
                fontSize: '48px',
                color: 'white',
                width: '210px',
                height: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {rates.chile}
            </div>

            {/* Colombia - Venezuela - In Green Box Area */}
            <div style={{
                position: 'absolute',
                top: '508px',
                left: '635px',
                fontSize: '60px',
                color: 'white',
                width: '210px',
                height: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {rates.colombia}
            </div>

            {/* EE.UU - Venezuela - In White Box Area */}
            <div style={{
                position: 'absolute',
                top: '622px',
                left: '635px',
                fontSize: '60px',
                color: 'white',
                width: '210px',
                height: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {rates.usa}
            </div>
        </div>
    );
}
