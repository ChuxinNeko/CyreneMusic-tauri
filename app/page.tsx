import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface Album {
  name: string
  artist: string
  cover: string
}

const albums: Album[] = [
  {
    name: "Async",
    artist: "Ryuichi Sakamoto",
    cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&dpr=2&q=80",
  },
  {
    name: "The Dark Side of the Moon",
    artist: "Pink Floyd",
    cover: "https://images.unsplash.com/photo-1619983081563-430f63602796?w=300&dpr=2&q=80",
  },
  {
    name: "Random Access Memories",
    artist: "Daft Punk",
    cover: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&dpr=2&q=80",
  },
  {
    name: "Abbey Road",
    artist: "The Beatles",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&dpr=2&q=80",
  },
  {
    name: "Kind of Blue",
    artist: "Miles Davis",
    cover: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&dpr=2&q=80",
  },
]

export default function Home() {
  return (
    <div className="h-full px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">欢迎来到 Cyrene Music</h1>
        <p className="text-muted-foreground text-sm mt-1">这是一个基于 Tauri 和 React 构建的高质量音乐播放器。</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">为您推荐</h2> // Changed text-2xl to text-xl to better match hierarchy
            <p className="text-sm text-muted-foreground">
              根据您的听歌历史生成的每日推荐。
            </p>
          </div>
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {albums.map((album) => (
            <Card key={album.name} className="border-0 shadow-none bg-transparent hover:bg-accent/50 transition-colors cursor-pointer group">
              <CardContent className="p-2">
                <div className="overflow-hidden rounded-md aspect-square mb-3 relative shadow-md">
                  <img
                    src={album.cover}
                    alt={album.name}
                    className="h-full w-full object-cover transition-all group-hover:scale-105"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <h3 className="font-medium leading-none truncate">{album.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Duplicate for visual effect filling the grid */}
          {albums.map((album) => (
            <Card key={album.name + "_dup"} className="border-0 shadow-none bg-transparent hover:bg-accent/50 transition-colors cursor-pointer group">
              <CardContent className="p-2">
                <div className="overflow-hidden rounded-md aspect-square mb-3 relative shadow-md">
                  <img
                    src={album.cover}
                    alt={album.name}
                    className="h-full w-full object-cover transition-all group-hover:scale-105"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <h3 className="font-medium leading-none truncate">{album.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
