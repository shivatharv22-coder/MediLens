'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable';

/**
 * Camera access for the scanner.
 *
 * Distinguishes "the user said no" from "this device has no camera", because
 * those need different guidance (§26). The stream is always stopped on unmount
 * so the camera indicator never stays lit after leaving the page.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchOn(false);
    setStatus('idle');
  }, []);

  const start = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }

      setStatus('starting');
      streamRef.current?.getTracks().forEach((track) => track.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        setFacingMode(mode);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchSupported(Boolean(capabilities?.torch));
        setStatus('ready');
      } catch (e) {
        const name = (e as DOMException).name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      }
    },
    [facingMode],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      // `torch` is not in the standard MediaTrackConstraintSet typing yet, but
      // it is what Chrome on Android implements.
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn, torchSupported]);

  const switchCamera = useCallback(() => {
    void start(facingMode === 'environment' ? 'user' : 'environment');
  }, [facingMode, start]);

  /** Grab the current frame as a JPEG blob at the video's native resolution. */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }, []);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    status,
    facingMode,
    torchOn,
    torchSupported,
    start,
    stop,
    capture,
    toggleTorch,
    switchCamera,
  };
}
