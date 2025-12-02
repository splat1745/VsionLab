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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Project {
  id: number
  name: string
  description: string
  project_type: string
  created_at: string
  classes: { name: string, color: string }[]
}

interface ProjectStats {
  total_images: number
  annotated_images: number
  total_annotations: number
  class_distribution: Record<string, number>
  split_distribution: Record<string, number>
}

export default function ProjectOverview() {
  const params = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeUsers, setActiveUsers] = useState<string[]>([])
  const [showStorageSelector, setShowStorageSelector] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [storageLocation, setStorageLocation] = useState<StorageLocation | null>(null) // Mock active users

  useEffect(() => {
    if (params.id) {
      fetchProject(Number(params.id))
      fetchStats(Number(params.id))
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
        
        <TabsContent value="annotate">
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Annotation Tool</h3>
                    <p className="text-muted-foreground">Select an image to start annotating.</p>
                    <Button className="mt-4" variant="secondary">Open Annotator</Button>
                </div>
            </div>
        </TabsContent>

        <TabsContent value="dataset">
            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Dataset Management</h3>
                    <p className="text-muted-foreground">Generate versions and export data.</p>
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
