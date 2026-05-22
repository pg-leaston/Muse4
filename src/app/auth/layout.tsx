export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#05010c] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,_rgba(98,34,182,0.42),_transparent_24%),radial-gradient(circle_at_80%_14%,_rgba(67,21,145,0.28),_transparent_24%),linear-gradient(180deg,_#0b0115_0%,_#06000d_100%)]" />
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
