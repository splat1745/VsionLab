"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Image as ImageIcon, Tag, Layers, Brain, Rocket, Settings, AlertTriangle } from "lucide-react"
import { StorageSelector, type StorageLocation } from "@/components/storage-selector"
import { ImageUpload } from "@/components/image-upload"
import { AnnotationCanvas } from "@/components/annotation-canvas"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Filter, Plus, Download, Edit } from "lucide-react"

interface Project {
  id: number
  name: string
  description: string
  project_type: string
  created_at: string
  classes: { id: number, name: string, color: string }[]
}

interface ProjectStats {
  total_images: number
  annotated_images: number
  total_annotations: number
  class_distribution: Record<string, number>
  split_distribution: Record<string, number>
}

interface Image {
  id: number
  filename: string
  filepath: string
  is_annotated: boolean
  created_at?: string
}

interface Dataset {
  id: number
  name: string
  split: string
  created_at: string
  image_count: number
  annotated_count: number
}

export default function ProjectOverview() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeUsers, setActiveUsers] = useState<string[]>([])
  const [showStorageSelector, setShowStorageSelector] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [storageLocation, setStorageLocation] = useState<StorageLocation | null>(null)
  
  // Annotation state
  const [images, setImages] = useState<Image[]>([])
  const [selectedImage, setSelectedImage] = useState<Image | null>(null)
  
  // Dataset state
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchProject(Number(params.id))
      fetchStats(Number(params.id))
      fetchImages(Number(params.id))
      fetchDatasets(Number(params.id))
      // Mock conflict detection
      if (Math.random() > 0.7) {
        setActiveUsers(["alice", "bob"])
      }
    }
  }, [params.id])

  const fetchProject = async (id: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/projects/${id}`)
      setProject(response.data)
    } catch (error) {
      console.error("Failed to fetch project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async (id: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/projects/${id}/stats`)
      setStats(response.data)
    } catch (error) {
      console.error("Failed to fetch stats:", error)
    }
  }

  const fetchImages = async (id: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/projects/${id}/images`)
      setImages(response.data)
    } catch (error) {
      console.error("Failed to fetch images:", error)
    }
  }

  const fetchDatasets = async (id: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/api/projects/${id}/datasets`)
      setDatasets(response.data)
      if (response.data.length > 0) {
        setSelectedDataset(response.data[0])
      }
    } catch (error) {
      console.error("Failed to fetch datasets:", error)
    }
  }

  if (isLoading || !project) return <div className="p-8">Loading...</div>

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* Conflict Alert */}
      {activeUsers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Multiple Users Active</AlertTitle>
          <AlertDescription>
            Users {activeUsers.join(", ")} are currently viewing this project. Be careful with concurrent edits.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge>{project.project_type}</Badge>
          </div>
          <p className="text-muted-foreground">{project.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>
          <Button onClick={() => setShowStorageSelector(true)}>
            <ImageIcon className="mr-2 h-4 w-4" /> Upload Data
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="annotate">Annotate</TabsTrigger>
          <TabsTrigger value="dataset">Dataset</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="train">Train</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_images || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annotated</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.annotated_images || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.total_images ? Math.round((stats.annotated_images / stats.total_images) * 100) : 0}% coverage
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annotations</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_annotations || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Classes</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{project.classes.length}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Class Distribution</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                {/* Chart placeholder */}
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Chart Component Here
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Activity items */}
                  <div className="flex items-center">
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium leading-none">Project Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="annotate" className="space-y-4">
          {selectedImage ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setSelectedImage(null)}>
                  Back to Gallery
                </Button>
                <h3 className="font-medium">{selectedImage.filename}</h3>
              </div>
              <AnnotationCanvas
                projectId={project.id}
                imageId={selectedImage.id}
                imageSrc={`http://localhost:8000/api/images/${selectedImage.id}/file`}
                classes={project.classes}
                onSave={() => {
                  fetchStats(project.id)
                  fetchImages(project.id)
                }}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
              {/* Unassigned Column */}
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex justify-between items-center">
                    Unassigned
                    <span className="text-muted-foreground text-xs">0 Batches</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col items-center justify-center border-t bg-muted/10">
                  <Button onClick={() => setShowStorageSelector(true)} className="gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Upload More Images
                  </Button>
                </CardContent>
              </Card>

              {/* Annotating Column */}
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex justify-between items-center">
                    Annotating
                    <span className="text-muted-foreground text-xs">{images.filter(i => !i.is_annotated).length} Images</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/10 border-t">
                  {images.filter(i => !i.is_annotated).length > 0 ? (
                    <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedImage(images.find(i => !i.is_annotated) || null)}>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">Unannotated Batch</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6"><Edit className="h-3 w-3" /></Button>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">
                            {images.filter(i => !i.is_annotated).length} Images
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary w-0" />
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-current" /> 0 Annotated</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-current" /> {images.filter(i => !i.is_annotated).length} Unannotated</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-8">No unannotated images</div>
                  )}
                </CardContent>
              </Card>

              {/* Dataset Column */}
              <Card className="flex flex-col h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex justify-between items-center">
                    Dataset
                    <span className="text-muted-foreground text-xs">{images.filter(i => i.is_annotated).length} Images</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-2 space-y-2 bg-muted/10 border-t">
                  {images.filter(i => i.is_annotated).length > 0 ? (
                    <Card>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium">Annotated Batch</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6"><Edit className="h-3 w-3" /></Button>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {images.filter(i => i.is_annotated).length} Images
                        </div>
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => {
                          const annotated = images.filter(i => i.is_annotated);
                          if (annotated.length > 0) setSelectedImage(annotated[0]);
                        }}>
                          Review Images
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-8">No annotated images</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="dataset" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search images" className="pl-8" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Split" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Splits</SelectItem>
                <SelectItem value="train">Train</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {project.classes.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select defaultValue="newest">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <ImageIcon className="mr-2 h-4 w-4" /> Search by Image
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border rounded" />
              <span className="text-sm text-muted-foreground">0 images selected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Show annotations</span>
              <div className="flex border rounded-md">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r"><Layers className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none"><ImageIcon className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((image) => (
              <div key={image.id} className="group relative">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden border relative">
                  <img
                    src={`http://localhost:8000/api/images/${image.id}/thumbnail`}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay for annotations - simplified visualization */}
                  {image.is_annotated && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-yellow-400/70" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2">
                    <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center rounded-md bg-purple-100 text-purple-700">
                      <Rocket className="h-3 w-3" />
                    </Badge>
                  </div>
                  {image.is_annotated && (
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="h-6 w-6 p-0 flex items-center justify-center rounded-md bg-yellow-100 text-yellow-700">
                        <Edit className="h-3 w-3" />
                      </Badge>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{image.filename}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Versions</h2>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create New Version
            </Button>
          </div>

          <div className="flex gap-6 h-[600px]">
            {/* Sidebar */}
            <div className="w-64 border-r pr-6 space-y-4">
              <div className="font-medium mb-2">Versions</div>
              {datasets.length > 0 ? (
                datasets.map(ds => (
                  <Card 
                    key={ds.id} 
                    className={`cursor-pointer transition-colors ${selectedDataset?.id === ds.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedDataset(ds)}
                  >
                    <CardContent className="p-3">
                      <div className="font-medium">{ds.name}</div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">v1</Badge>
                        <Badge variant="outline" className="text-xs flex gap-1">
                          <ImageIcon className="h-3 w-3" /> {ds.image_count}
                        </Badge>
                        <Badge variant="outline" className="text-xs">640x640</Badge>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">Stretch to</Badge>
                        <Badge variant="secondary" className="text-xs">user</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No versions created yet.</div>
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6">
              {selectedDataset ? (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-black text-white">v1</Badge>
                        <h3 className="text-xl font-bold">{selectedDataset.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Generated on {new Date(selectedDataset.created_at).toLocaleDateString()} by user
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" /> Download Dataset
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <Edit className="h-4 w-4" /> Edit
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded border flex items-center justify-center text-green-500">✓</div>
                      <span className="font-medium">{project.name} 1</span>
                      <Button variant="outline" size="sm" className="ml-auto gap-2">
                        View Model <Rocket className="h-3 w-3" />
                      </Button>
                    </div>

                    <Card>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <div className="text-sm font-medium mb-4">Model URL:</div>
                            <div className="text-sm text-muted-foreground">jjs-l6maw-lgvgf/1</div>
                            
                            <div className="text-sm font-medium mt-4 mb-4">Updated On:</div>
                            <div className="text-sm text-muted-foreground">2025-11-30, 8:15 p.m.</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium mb-4">Checkpoint:</div>
                            <div className="text-sm text-muted-foreground">-</div>
                            
                            <div className="text-sm font-medium mt-4 mb-4">Model Type:</div>
                            <div className="text-sm text-muted-foreground">RF-DETR (Small)</div>
                          </div>
                        </div>

                        <div className="mt-8 border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="font-medium">Metrics</span>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="grid grid-cols-3 gap-8">
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Valid Set</div>
                              <div className="flex items-end gap-2">
                                <div className="h-12 w-2 bg-muted rounded-full overflow-hidden relative">
                                  <div className="absolute bottom-0 w-full bg-primary h-[88%]" />
                                </div>
                                <div>
                                  <div className="text-xs font-medium">mAP@50</div>
                                  <div className="text-lg font-bold">88.1%</div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">&nbsp;</div>
                              <div className="flex items-end gap-2">
                                <div className="h-12 w-2 bg-muted rounded-full overflow-hidden relative">
                                  <div className="absolute bottom-0 w-full bg-primary h-[91%]" />
                                </div>
                                <div>
                                  <div className="text-xs font-medium">Precision</div>
                                  <div className="text-lg font-bold">91.3%</div>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">External</div>
                              <div className="flex items-end gap-2">
                                <div className="h-12 w-2 bg-muted rounded-full overflow-hidden relative">
                                  <div className="absolute bottom-0 w-full bg-primary h-[82%]" />
                                </div>
                                <div>
                                  <div className="text-xs font-medium">Recall</div>
                                  <div className="text-lg font-bold">82.0%</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                    <Layers className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">No Version Selected</h3>
                    <p className="text-muted-foreground">Select a version from the sidebar or create a new one.</p>
                  </div>
                  <Button onClick={() => {
                    // Mock creation
                    const newDs = {
                      id: Date.now(),
                      name: `Dataset${datasets.length + 1}JJS`,
                      split: 'train',
                      created_at: new Date().toISOString(),
                      image_count: images.length,
                      annotated_count: images.filter(i => i.is_annotated).length
                    };
                    setDatasets([...datasets, newDs]);
                    setSelectedDataset(newDs);
                  }}>
                    Create New Version
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="train">
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Training</h3>
                    <p className="text-muted-foreground">Configure and start training jobs.</p>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="deploy">
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Deployment</h3>
                    <p className="text-muted-foreground">Test your model with inference API.</p>
                </div>
            </div>
        </TabsContent>
      </Tabs>

      {/* Storage Selector Dialog */}
      <StorageSelector
        open={showStorageSelector}
        onClose={() => setShowStorageSelector(false)}
        onSelect={(location) => {
          setStorageLocation(location)
          setShowStorageSelector(false)
          setShowUpload(true)
        }}
        projectId={project?.id || 0}
      />

      {/* Image Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Upload Images</DialogTitle>
            <DialogDescription>
              Add images to your project for annotation and training.
            </DialogDescription>
          </DialogHeader>
          {storageLocation && project && (
            <ImageUpload
              projectId={project.id}
              storageLocation={storageLocation}
              onComplete={() => {
                setShowUpload(false)
                fetchStats(project.id)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
