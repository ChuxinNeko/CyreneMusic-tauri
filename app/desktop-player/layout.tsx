import "../globals.css"

export const metadata = {
    title: "Desktop Player - Cyrene Music",
    description: "Desktop background player for Cyrene Music",
}

export default function DesktopPlayerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="h-screen w-screen m-0 overflow-hidden bg-transparent p-0 font-sans text-white select-none">
            {children}
        </div>
    )
}
