import KFSDK from '@kissflow/lowcode-client-sdk'
import React, { useEffect, useState } from 'react'
import { KissflowSDKContext } from './context.jsx'

let kf

/**
 * ITSM-style wrapper:
 * - Inside Kissflow → live SDK
 * - Local / preview → still render children; dashboards fall back to mock data
 */
export function SDKWrapper(props) {
    const [kfInstance, setKfInstance] = useState(null)
    const [sdkSettled, setSdkSettled] = useState(false)

    useEffect(() => {
        if (window.kf) {
            kf = window.kf
            setKfInstance(window.kf)
            setSdkSettled(true)
            return
        }

        KFSDK.initialize()
            .then((sdk) => {
                window.kf = kf = sdk
                setKfInstance(sdk)
                setSdkSettled(true)
                console.info('SDK initialized successfully')
            })
            .catch((err) => {
                setSdkSettled(true)
                console.warn(
                    'SDK not available (preview mode):',
                    err?.message || err,
                )
            })
    }, [])

    return (
        <KissflowSDKContext.Provider
            value={{ kf: kfInstance, sdkReady: sdkSettled }}
        >
            {sdkSettled ? props.children : null}
        </KissflowSDKContext.Provider>
    )
}

export { kf }
