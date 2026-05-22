import { AuthEntryPrompt } from "@/components/auth/auth-entry-prompt";
import { PlayBar } from "@/components/music/play-bar";
import { AudioPlayerProvider } from "@/contexts/audio-player-context";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AudioPlayerProvider>
      <div className="min-h-screen bg-[#05010c] text-white">
        <AuthEntryPrompt />
        <PlayBar />
        {children}
      </div>
    </AudioPlayerProvider>
  );
}
