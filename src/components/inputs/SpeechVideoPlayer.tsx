"use client";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

export type SpeechVideoPlayerHandle = {
  seekTo: (seconds: number) => void;
};

type SpeechVideoPlayerProps = {
  src: string;
  className?: string;
};

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embed = u.pathname.match(/^\/embed\/([^/?]+)/);
      if (embed) return embed[1];
    }
  } catch {
    return null;
  }
  return null;
}

const SpeechVideoPlayer = forwardRef<
  SpeechVideoPlayerHandle,
  SpeechVideoPlayerProps
>(function SpeechVideoPlayer({ src, className = "" }, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const youtubeId = useMemo(() => getYouTubeId(src), [src]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        if (youtubeId && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [seconds, true],
            }),
            "*"
          );
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "playVideo",
              args: [],
            }),
            "*"
          );
          return;
        }
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          void videoRef.current.play().catch(() => {});
        }
      },
    }),
    [youtubeId]
  );

  if (youtubeId) {
    const embedSrc = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&rel=0`;
    return (
      <div
        className={`relative w-full aspect-video overflow-hidden rounded-lg bg-black ${className}`}
      >
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title="Speech video"
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-hidden rounded-lg bg-black ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full h-auto"
        preload="metadata"
      >
        Your browser does not support the video element.
      </video>
    </div>
  );
});

export default SpeechVideoPlayer;
