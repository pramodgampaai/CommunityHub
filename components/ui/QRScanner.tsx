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
            <div className="bg-slate-900 text-white p-6 rounded-[2rem] text-center flex flex-col items-center justify-center min-h-[300px] border border-white/10">
                <p className="text-rose-400 font-bold mb-4">{error}</p>
                <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest">Close Registry</button>
            </div>
        );
    }

    return (
        <div className="relative bg-slate-900 rounded-[2.5rem] overflow-hidden flex items-center justify-center min-h-[350px] shadow-2xl border border-slate-200 dark:border-white/5">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay UI - Responsive Masks */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Responsive darkened borders */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-slate-900/40 dark:bg-black/70 backdrop-blur-[2px]"></div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900/40 dark:bg-black/70 backdrop-blur-[2px]"></div>
                <div className="absolute top-16 bottom-16 left-0 w-8 bg-slate-900/40 dark:bg-black/70 backdrop-blur-[2px]"></div>
                <div className="absolute top-16 bottom-16 right-0 w-8 bg-slate-900/40 dark:bg-black/70 backdrop-blur-[2px]"></div>
                
                {/* Scan Frame */}
                <div className="absolute top-16 bottom-16 left-8 right-8 border-2 border-brand-500 rounded-2xl opacity-90 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                    <div className="qr-scanner-line"></div>
                </div>
            </div>

            <div className="absolute bottom-6 left-0 right-0 text-center text-white dark:text-brand-50 text-[10px] font-black uppercase tracking-widest drop-shadow-lg z-10">
                Align Digital QR inside the perimeter
            </div>

            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-xl transition-all backdrop-blur-md z-20 border border-white/10 group"
            >
                <XIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
        </div>
    );
};

export default QRScanner;