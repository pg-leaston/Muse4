import { AudioPlayerProvider } from "@/contexts/audio-player-context";
import { PlayBar } from "@/components/music/play-bar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioPlayerProvider>
      <div className="min-h-screen bg-[#05010c] text-white">
        <PlayBar />
        {children}
      </div>
    </AudioPlayerProvider>
  );
}
