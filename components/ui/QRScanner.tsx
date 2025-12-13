
import React, { useEffect, useRef, useState } from 'react';
import { XIcon } from '../icons';

interface QRScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;

        const startCamera = async () => {
            try {
                const constraints = {
                    video: { facingMode: 'environment' }
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Required for iOS Safari
                    videoRef.current.setAttribute('playsinline', 'true'); 
                    videoRef.current.play();
                    requestRef.current = requestAnimationFrame(tick);
                }
            } catch (err: any) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please ensure you have granted permission.");
            }
        };

        const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                
                if (canvas) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    const ctx = canvas.getContext('2d');
                    
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        
                        // Use global jsQR loaded via script tag
                        const code = (window as any).jsQR ? (window as any).jsQR(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: "dontInvert",
                        }) : null;

                        if (code) {
                            onScan(code.data);
                            // Don't loop if found (or let parent handle unmount)
                            return; 
                        }
                    }
                }
            }
            requestRef.current = requestAnimationFrame(tick);
        };

        startCamera();

        return () => {
            if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [onScan]);

    if (error) {
        return (
            <div className="bg-black text-white p-6 rounded-lg text-center flex flex-col items-center justify-center min-h-[300px]">
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={onClose} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Close</button>
            </div>
        );
    }

    return (
        <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[350px]">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Darkened borders */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-sm"></div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/50 backdrop-blur-sm"></div>
                <div className="absolute top-16 bottom-16 left-0 w-8 bg-black/50 backdrop-blur-sm"></div>
                <div className="absolute top-16 bottom-16 right-0 w-8 bg-black/50 backdrop-blur-sm"></div>
                
                {/* Scan Frame */}
                <div className="absolute top-16 bottom-16 left-8 right-8 border-2 border-[var(--accent)] rounded-lg opacity-70">
                    <div className="qr-scanner-line"></div>
                </div>
            </div>

            <div className="absolute bottom-4 left-0 right-0 text-center text-white text-sm font-medium drop-shadow-md">
                Align QR Code within the frame
            </div>

            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-md z-10"
            >
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default QRScanner;
