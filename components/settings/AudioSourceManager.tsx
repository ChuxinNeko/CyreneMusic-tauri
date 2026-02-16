
import React, { useState } from 'react'
import { Plus, Trash2, Edit2, Check, ExternalLink, ShieldCheck, FileCode, Layers, Music, FileUp, AlertCircle, Link, Download } from 'lucide-react'
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
    const { sources, activeSourceId, addSource, updateSource, removeSource, setActiveSource } = useAudioSourceStore()
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [editingSource, setEditingSource] = useState<AudioSourceConfig | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)
    const [lxUrl, setLxUrl] = useState('')
    const [isFetching, setIsFetching] = useState(false)

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
                        选择并管理您的音频解析服务
                    </p>
                </div>
                <Button onClick={handleOpenAddDialog} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    添加音源
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                    sources.map((source) => (
                        <Card
                            key={source.id}
                            className={cn(
                                "relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer group",
                                activeSourceId === source.id ? "ring-2 ring-primary border-primary/20 bg-primary/5" : "hover:border-primary/20"
                            )}
                            onClick={() => setActiveSource(source.id)}
                        >
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        activeSourceId === source.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                    )}>
                                        {getSourceIcon(source.type)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <CardTitle className="text-base">{source.name}</CardTitle>
                                            {activeSourceId === source.id && (
                                                <div className="bg-primary/20 text-primary text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                    <Check className="h-3 w-3" />
                                                    活跃
                                                </div>
                                            )}
                                        </div>
                                        <CardDescription className="text-xs flex items-center gap-1 truncate max-w-[240px]">
                                            {getSourceTypeName(source.type)} • {source.type === AudioSourceType.OmniParse ? "(URL 已隐藏)" : source.url.replace(/https?:\/\//, '')}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenEditDialog(source);
                                        }}
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeSource(source.id);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingSource ? '编辑音源' : '添加新音源'}</DialogTitle>
                        <DialogDescription>
                            配置音频解析服务的详细信息。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept=".cyrene,.js"
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
                    <DialogFooter>
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
