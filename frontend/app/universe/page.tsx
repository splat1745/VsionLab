"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Download, Box } from "lucide-react"
import { Input } from "@/components/ui/input"

interface ModelVersion {
  id: number
  project_id: number
  name: string
  version: number
  architecture: string
  status: string
  metrics: {
    map50?: number
    precision?: number
    recall?: number
  }
  created_at: string
}

export default function UniversePage() {
  const [models, setModels] = useState<ModelVersion[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/registry/")
      setModels(res.data)
    } catch (error) {
      console.error("Failed to fetch models", error)
    }
  }

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.architecture.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Universe (Model Registry)</h1>
        <p className="text-muted-foreground">Browse and deploy trained models.</p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search models..." 
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModels.map(model => (
          <Card key={model.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{model.name} v{model.version}</CardTitle>
                  <CardDescription>{model.architecture}</CardDescription>
                </div>
                <Badge variant={model.status === "completed" ? "default" : "secondary"}>
                  {model.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">mAP50</span>
                    <span className="font-bold">{(model.metrics.map50 || 0).toFixed(3)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Precision</span>
                    <span className="font-bold">{(model.metrics.precision || 0).toFixed(3)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Recall</span>
                    <span className="font-bold">{(model.metrics.recall || 0).toFixed(3)}</span>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" className="w-full">
                    <Box className="mr-2 h-4 w-4" /> Test
                  </Button>
                  <Button className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
