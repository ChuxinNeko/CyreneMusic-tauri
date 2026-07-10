import "../globals.css"

export const metadata = {
    title: "Desktop Player Controls - Cyrene Music",
}

export default function DesktopPlayerBarLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div
            data-transparent-window
            className="m-0 h-screen w-screen overflow-hidden bg-transparent p-0 font-sans text-white select-none"
        >
            {children}
        </div>
    )
}
