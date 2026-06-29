
import React, { useState, useRef } from 'react'
import { Plus, Trash2, Edit2, Check, ExternalLink, ShieldCheck, FileCode, Layers, Music, FileUp, AlertCircle, Link, Download, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { useAudioSourceStore } from '@/lib/store/useAudioSourceStore'
import { AudioSourceConfig, AudioSourceType } from '@/lib/models/audioSourceConfig'
import { cn } from '@/lib/utils'
import { cyreneConfigService } from '@/lib/services/cyreneConfigService'
import { lxMusicSourceService } from '@/lib/services/lxMusicSourceService'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function AudioSourceManager() {
    const { sources, addSource, updateSource, removeSource, reorderSources } = useAudioSourceStore()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [editingSource, setEditingSource] = useState<AudioSourceConfig | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [lxUrl, setLxUrl] = useState('')
    const [isFetching, setIsFetching] = useState(false)

    // --- 指针拖拽排序状态 ---
    const [draggedId, setDraggedId] = useState<string | null>(null)

    // --- 指针拖拽排序事件处理 ---
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, sourceId: string) => {
        if (e.button !== 0) return // 只允许鼠标左键
        const target = e.currentTarget
        target.setPointerCapture(e.pointerId)
        setDraggedId(sourceId)
        e.preventDefault() // 阻止默认行为以防拖动时选中文本
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>, sourceId: string) => {
        if (draggedId !== sourceId) return

        const currentY = e.clientY

        // 获取列表容器中所有带有 data-drag-card 属性的 DOM 元素
        const container = e.currentTarget.closest('.audio-sources-list') as HTMLElement
        if (!container) return

        const cards = Array.from(container.querySelectorAll('[data-drag-card]')) as HTMLElement[]

        // 找到当前拖动卡片的 index
        const currentIndex = cards.findIndex(card => card.getAttribute('data-drag-card') === sourceId)
        if (currentIndex === -1) return

        // 检查鼠标 clientY 跨过了哪个卡片的中点，从而进行实时交换
        for (let i = 0; i < cards.length; i++) {
            if (i === currentIndex) continue

            const otherCard = cards[i]
            const rect = otherCard.getBoundingClientRect()
            const midY = rect.top + rect.height / 2

            // 向上拖动：如果鼠标在当前卡片上方的卡片中点之上
            if (i < currentIndex && currentY < midY) {
                reorderSources(currentIndex, i)
                break
            }
            // 向下拖动：如果鼠标在当前卡片下方的卡片中点之下
            if (i > currentIndex && currentY > midY) {
                reorderSources(currentIndex, i)
                break
            }
        }
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>, sourceId: string) => {
        if (draggedId === sourceId) {
            e.currentTarget.releasePointerCapture(e.pointerId)
            setDraggedId(null)
        }
    }

    const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>, sourceId: string) => {
        if (draggedId === sourceId) {
            e.currentTarget.releasePointerCapture(e.pointerId)
            setDraggedId(null)
        }
    }

    const [formData, setFormData] = useState<Partial<AudioSourceConfig>>({
        type: AudioSourceType.OmniParse,
        name: '',
        url: '',
        apiKey: '',
    })

    const handleOpenAddDialog = () => {
        setFormData({
            type: AudioSourceType.OmniParse,
            name: '',
            url: '',
            apiKey: '',
        })
        setEditingSource(null)
        setLxUrl('')
        setIsAddDialogOpen(true)
    }

    const handleOpenEditDialog = (source: AudioSourceConfig) => {
        setFormData({ ...source })
        setEditingSource(source)
        setIsAddDialogOpen(true)
    }

    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.cyrene') && !file.name.endsWith('.js')) {
            toast.error("仅支持 .cyrene 或 .js 格式的配置文件");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            if (arrayBuffer) {
                if (file.name.endsWith('.cyrene')) {
                    const config = await cyreneConfigService.decrypt(new Uint8Array(arrayBuffer));
                    if (config) {
                        setFormData(prev => ({
                            ...prev,
                            name: config.name,
                            url: config.url,
                            apiKey: config.apiKey,
                        }));
                        toast.success("配置文件解析成功");
                    } else {
                        toast.error("配置文件解析失败，请检查文件是否损坏或密码不正确。");
                    }
                } else if (file.name.endsWith('.js')) {
                    const content = new TextDecoder().decode(arrayBuffer);
                    const config = lxMusicSourceService.parseScript(content);
                    if (config) {
                        setFormData(prev => ({
                            ...prev,
                            name: config.name,
                            url: config.apiUrl,
                            apiKey: config.apiKey,
                            version: config.version,
                            author: config.author,
                            description: config.description,
                            scriptContent: config.scriptContent,
                            urlPathTemplate: config.urlPathTemplate,
                            scriptSource: file.name
                        }));
                        toast.success(`洛雪脚本解析成功: ${config.name}`);
                    } else {
                        toast.error("脚本解析失败，请确保是有效的洛雪音源脚本。");
                    }
                } else {
                    toast.error("不支持的文件类型。");
                }
            }
        };
        reader.readAsArrayBuffer(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUrlImport = async () => {
        if (!lxUrl) return;
        setIsFetching(true);
        try {
            if (!lxUrl.startsWith('http')) {
                toast.error("请输入有效的 HTTP/HTTPS 链接");
                return;
            }

            const config = await lxMusicSourceService.fetchAndParse(lxUrl);
            if (config) {
                setFormData(prev => ({
                    ...prev,
                    name: config.name,
                    url: config.apiUrl,
                    apiKey: config.apiKey,
                    version: config.version,
                    author: config.author,
                    description: config.description,
                    scriptContent: config.scriptContent,
                    urlPathTemplate: config.urlPathTemplate,
                    scriptSource: lxUrl
                }));
                toast.success(`脚本下载并解析成功: ${config.name}`);
            } else {
                toast.error("脚本下载或解析失败，请检查 URL 是否正确。");
            }
        } catch (error) {
            toast.error("网络请求失败");
        } finally {
            setIsFetching(false);
        }
    };

    const handleSave = () => {
        if (!formData.name || !formData.url) return

        if (editingSource) {
            updateSource({ ...editingSource, ...formData } as AudioSourceConfig)
        } else {
            const newSource: AudioSourceConfig = {
                id: Date.now().toString(),
                supportedPlatforms: [],
                version: '',
                author: '',
                description: '',
                scriptSource: '',
                scriptContent: '',
                urlPathTemplate: '',
                ...formData,
            } as AudioSourceConfig
            addSource(newSource)
        }
        setIsAddDialogOpen(false)
    }

    const getSourceIcon = (type: AudioSourceType) => {
        switch (type) {
            case AudioSourceType.OmniParse:
                return <Layers className="h-5 w-5" />
            case AudioSourceType.LxMusic:
                return <FileCode className="h-5 w-5" />
            case AudioSourceType.TuneHub:
                return <ShieldCheck className="h-5 w-5" />
            default:
                return <Layers className="h-5 w-5" />
        }
    }

    const getSourceTypeName = (type: AudioSourceType) => {
        switch (type) {
            case AudioSourceType.OmniParse: return 'OmniParse'
            case AudioSourceType.LxMusic: return '洛雪音源'
            case AudioSourceType.TuneHub: return 'TuneHub'
            default: return '未知'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight">已配置音源</h2>
                    <p className="text-sm text-muted-foreground">
                        拖拽调整优先级，播放时将按顺序尝试各音源
                    </p>
                </div>
                <Button onClick={handleOpenAddDialog} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    添加音源
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 audio-sources-list">
                {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl bg-muted/30 text-center space-y-4">
                        <div className="p-4 bg-background rounded-full shadow-sm">
                            <Music className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-medium">暂无已配置音源</h3>
                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                您需要至少配置一个音源才能正常解析并播放歌曲。
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleOpenAddDialog}>
                            立即添加
                        </Button>
                    </div>
                ) : (
                    sources.map((source, index) => (
                        <Card
                            key={source.id}
                            data-drag-card={source.id}
                            className={cn(
                                "relative overflow-hidden transition-all duration-300 group select-none",
                                source.id === draggedId
                                    ? "ring-2 ring-primary/60 border-primary/30 bg-primary/5 shadow-lg scale-[1.01] opacity-90 z-10 cursor-grabbing"
                                    : index === 0
                                        ? "ring-2 ring-primary border-primary/20 bg-primary/5 hover:shadow-md"
                                        : "hover:border-primary/20 hover:shadow-md"
                            )}
                        >
                            <CardHeader className="p-3 md:p-4 md:pb-2 flex flex-row items-center justify-between space-y-0 gap-2">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    {/* 拖拽手柄 */}
                                    <div
                                        onPointerDown={(e) => handlePointerDown(e, source.id)}
                                        onPointerMove={(e) => handlePointerMove(e, source.id)}
                                        onPointerUp={(e) => handlePointerUp(e, source.id)}
                                        onPointerCancel={(e) => handlePointerCancel(e, source.id)}
                                        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors p-1 md:p-1.5 rounded hover:bg-muted/50 touch-none shrink-0"
                                    >
                                        <GripVertical className="h-4 w-4 md:h-5 md:w-5" />
                                    </div>
                                    {/* 优先级序号 */}
                                    <div className={cn(
                                        "flex items-center justify-center h-5 w-5 md:h-6 md:w-6 rounded-full text-[10px] md:text-xs font-bold shrink-0 transition-colors",
                                        index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                        {index + 1}
                                    </div>
                                    <div className={cn(
                                        "p-1.5 md:p-2 rounded-lg transition-colors shrink-0",
                                        index === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                    )}>
                                        {React.cloneElement(getSourceIcon(source.type) as React.ReactElement, { className: 'h-4 w-4 md:h-5 md:w-5' })}
                                    </div>
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <CardTitle className="text-sm md:text-base truncate">{source.name}</CardTitle>
                                            {index === 0 && (
                                                <div className="bg-primary/20 text-primary text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                                                    <Check className="h-3 w-3" />
                                                    <span className="hidden sm:inline">最高优先</span>
                                                </div>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs flex items-center gap-1 truncate">
                                            {getSourceTypeName(source.type)} • {source.type === AudioSourceType.OmniParse ? "(URL 已隐藏)" : source.url.replace(/https?:\/\//, '')}
                                        </CardDescription>
                                    </div>
                                </div>
                                {/* 移动端始终可见，桌面端仅在 hover 时显示 */}
                                <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditDialog(source);
                                        }}
                                    >
                                        <Edit2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeSource(source.id);
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[440px] max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 shrink-0">
                        <DialogTitle>{editingSource ? '编辑音源' : '添加新音源'}</DialogTitle>
                        <DialogDescription>
                            配置音频解析服务的详细信息。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept={formData.type === AudioSourceType.OmniParse ? ".cyrene" : formData.type === AudioSourceType.LxMusic ? ".js,.txt,*/*" : ".cyrene,.js"}
                        />
                        <div className="space-y-3">
                            <Label>解析类型</Label>
                            <RadioGroup
                                value={formData.type?.toString()}
                                onValueChange={(v) => setFormData({ ...formData, type: parseInt(v) })}
                                className="grid grid-cols-3 gap-2"
                                disabled={!!editingSource}
                            >
                                <div className="flex items-center">
                                    <RadioGroupItem value="0" id="omni" className="peer sr-only" />
                                    <Label
                                        htmlFor="omni"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer"
                                    >
                                        <Layers className="mb-1 h-4 w-4" />
                                        <span className="text-[10px]">Omni</span>
                                    </Label>
                                </div>
                                <div className="flex items-center">
                                    <RadioGroupItem value="1" id="lx" className="peer sr-only" />
                                    <Label
                                        htmlFor="lx"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer"
                                    >
                                        <FileCode className="mb-1 h-4 w-4" />
                                        <span className="text-[10px]">LxMusic</span>
                                    </Label>
                                </div>
                                <div className="flex items-center">
                                    <RadioGroupItem value="2" id="tune" className="peer sr-only" />
                                    <Label
                                        htmlFor="tune"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary w-full cursor-pointer"
                                    >
                                        <ShieldCheck className="mb-1 h-4 w-4" />
                                        <span className="text-[10px]">TuneHub</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {formData.type === AudioSourceType.OmniParse && !editingSource && (
                            <div
                                className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer space-y-3"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="p-3 bg-background rounded-full shadow-sm">
                                    <FileUp className="h-6 w-6 text-primary" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium">点击导入 .cyrene 文件</p>
                                    <p className="text-xs text-muted-foreground mt-1">导入后将自动填写配置信息</p>
                                </div>
                            </div>
                        )}

                        {formData.type === AudioSourceType.OmniParse && formData.url && (
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div className="space-y-1 min-w-0">
                                    <p className="text-sm font-medium leading-none">已导入配置</p>
                                    <p className="text-xs text-muted-foreground truncate font-mono">
                                        URL: ••••••••••••••••
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate font-mono">
                                        Name: {formData.name}
                                    </p>
                                </div>
                            </div>
                        )}

                        {formData.type === AudioSourceType.LxMusic && !editingSource && (
                            <Tabs defaultValue="file" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="file">文件导入</TabsTrigger>
                                    <TabsTrigger value="url">链接导入</TabsTrigger>
                                </TabsList>
                                <TabsContent value="file" className="pt-4">
                                    <div
                                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer space-y-3"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="p-3 bg-background rounded-full shadow-sm">
                                            <FileCode className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium">点击导入 .js 脚本文件</p>
                                            <p className="text-xs text-muted-foreground mt-1">支持传统的洛雪音源脚本</p>
                                        </div>
                                    </div>
                                </TabsContent>
                                <TabsContent value="url" className="pt-4 space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="https://example.com/source.js"
                                            value={lxUrl}
                                            onChange={(e) => setLxUrl(e.target.value)}
                                        />
                                        <Button
                                            size="sm"
                                            onClick={handleUrlImport}
                                            disabled={isFetching || !lxUrl}
                                        >
                                            {isFetching ? "下载中..." : "导入"}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        请输入洛雪音源 JS 脚本的直链地址。
                                    </p>
                                </TabsContent>
                            </Tabs>
                        )}

                        {formData.type === AudioSourceType.LxMusic && formData.name && (
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                                <FileCode className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <div className="space-y-1 min-w-0">
                                    <p className="text-sm font-medium leading-none">解析成功: {formData.name}</p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-muted-foreground">
                                        {formData.version && <span>版本: {formData.version}</span>}
                                        {formData.author && <span>作者: {formData.author}</span>}
                                    </div>
                                    {formData.url && (
                                        <p className="text-[10px] text-muted-foreground truncate font-mono mt-1">
                                            API: {formData.url}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="name">音源名称</Label>
                            <Input
                                id="name"
                                placeholder="例如: 官方解析器"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={(formData.type === AudioSourceType.OmniParse && !editingSource) || (formData.type === AudioSourceType.LxMusic && !!formData.name && !editingSource)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="url">API 地址</Label>
                            <Input
                                id="url"
                                placeholder="https://api.example.com"
                                value={formData.type === AudioSourceType.OmniParse ? "••••••••••••••••" : formData.url}
                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                disabled={formData.type === AudioSourceType.OmniParse}
                            />
                        </div>
                        {(formData.type === AudioSourceType.LxMusic || formData.type === AudioSourceType.TuneHub) && (
                            <div className="grid gap-2">
                                <Label htmlFor="apiKey">API Key (可选)</Label>
                                <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="输入访问密钥"
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-6 pt-4 shrink-0 border-t bg-muted/30">
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSave} disabled={!formData.name || !formData.url}>
                            保存配置
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
