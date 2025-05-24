import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff, AlertCircle, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

const NetworkStatus = () => {
    const [networkInfo, setNetworkInfo] = useState({
        online: navigator.onLine,
        type: 'unknown',
        speed: 'unknown',
        effectiveType: 'unknown',
        rtt: 'unknown',
        downlink: 'unknown'
    });
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const updateNetworkInfo = () => {
            if ('connection' in navigator) {
                const connection = navigator.connection;
                setNetworkInfo({
                    online: navigator.onLine,
                    type: connection.type || 'unknown',
                    speed: connection.speed || 'unknown',
                    effectiveType: connection.effectiveType || 'unknown',
                    rtt: connection.rtt || 'unknown',
                    downlink: connection.downlink || 'unknown'
                });
            } else {
                setNetworkInfo(prev => ({
                    ...prev,
                    online: navigator.onLine
                }));
            }
        };

        // Initial update
        updateNetworkInfo();

        // Add event listeners
        window.addEventListener('online', updateNetworkInfo);
        window.addEventListener('offline', updateNetworkInfo);
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', updateNetworkInfo);
        }

        // Cleanup
        return () => {
            window.removeEventListener('online', updateNetworkInfo);
            window.removeEventListener('offline', updateNetworkInfo);
            if ('connection' in navigator) {
                navigator.connection.removeEventListener('change', updateNetworkInfo);
            }
        };
    }, []);

    const getConnectionQuality = () => {
        if (!networkInfo.online) return 'offline';
        if (networkInfo.effectiveType === '4g') return 'good';
        if (networkInfo.effectiveType === '3g') return 'fair';
        if (networkInfo.effectiveType === '2g') return 'poor';
        return 'unknown';
    };

    const getConnectionColor = () => {
        switch (getConnectionQuality()) {
            case 'good': return 'text-green-500';
            case 'fair': return 'text-yellow-500';
            case 'poor': return 'text-orange-500';
            case 'offline': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getConnectionBGColor = () => {
        switch (getConnectionQuality()) {
            case 'good': return 'bg-green-500';
            case 'fair': return 'bg-yellow-500';
            case 'poor': return 'bg-orange-500';
            case 'offline': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const getNetworkTypeDisplay = (type) => {
        switch (type) {
            case 'wifi': return 'Wi-Fi';
            case 'cellular': return 'Cellular';
            case 'ethernet': return 'Ethernet';
            case 'none': return 'No Connection';
            default: return null;
        }
    };

    const getEffectiveTypeDisplay = (type) => {
        switch (type) {
            case '4g': return '4G';
            case '3g': return '3G';
            case '2g': return '2G';
            case 'slow-2g': return 'Slow 2G';
            default: return null;
        }
    };

    const isValidValue = (value) => {
        return value !== 'unknown' && value !== null && value !== undefined;
    };

    if (!isExpanded) {
        return (
            <Button
                variant="outline"
                className={`fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 ${getConnectionBGColor()} backdrop-blur-sm shadow-lg hover:bg-${getConnectionBGColor()}/30 transition-colors duration-200`}
                onClick={() => setIsExpanded(true)}
            >
                <div className="relative flex items-center gap-2">
                    <span className={`font-medium text-white`}>Network</span>
                    {getConnectionQuality() === 'poor' && (
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                    )}
                </div>
            </Button>
        );
    }

    return (
        <Card className="fixed bottom-4 right-4 z-50 w-64 bg-white/90 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        {networkInfo.online ? (
                            <Wifi className={`w-5 h-5 ${getConnectionColor()}`} />
                        ) : (
                            <WifiOff className="w-5 h-5 text-red-500" />
                        )}
                        <span className="text-sm font-medium">
                            {networkInfo.online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setIsExpanded(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                {networkInfo.online && (
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                        {isValidValue(networkInfo.type) && (
                            <div>Type: {getNetworkTypeDisplay(networkInfo.type)}</div>
                        )}
                        {isValidValue(networkInfo.speed) && (
                            <div>Speed: {networkInfo.speed} Mbps</div>
                        )}
                        {isValidValue(networkInfo.effectiveType) && (
                            <div>Network: {getEffectiveTypeDisplay(networkInfo.effectiveType)}</div>
                        )}
                        {isValidValue(networkInfo.rtt) && (
                            <div>RTT: {networkInfo.rtt}ms</div>
                        )}
                        {isValidValue(networkInfo.downlink) && (
                            <div>Downlink: {networkInfo.downlink} Mbps</div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default NetworkStatus; 
