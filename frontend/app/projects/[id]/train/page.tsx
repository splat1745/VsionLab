"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Node {
  id: number
  name: string
  ip_address: string
  has_gpu: boolean
  gpu_name: string
  vram_total: number
  current_load: number
  is_active: boolean
}

export default function TrainingPage() {
  const params = useParams()
  const { user } = useAuth()
  const [nodes, setNodes] = useState<Node[]>([])
  const [selectedNode, setSelectedNode] = useState<string>("")
  const [config, setConfig] = useState({
    epochs: 100,
    batch_size: 16,
    img_size: 640,
    learning_rate: 0.01,
    model_architecture: "yolov8n"
  })
  const [trainingStatus, setTrainingStatus] = useState<any>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  useEffect(() => {
    fetchNodes()
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (jobId) {
      interval = setInterval(checkStatus, 2000)
    }
    return () => clearInterval(interval)
  }, [jobId])

  const fetchNodes = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/nodes/")
      setNodes(res.data)
    } catch (error) {
      console.error("Failed to fetch nodes", error)
    }
  }

  const checkStatus = async () => {
    // In a real app, we'd poll the specific job status endpoint
    // For now, we'll mock or assume we have an endpoint
    // const res = await axios.get(`http://localhost:8000/api/training/${jobId}/status`)
    // setTrainingStatus(res.data)
  }

  const startTraining = async () => {
    try {
      const node = nodes.find(n => n.id.toString() === selectedNode)
      const nodeUrl = node ? `http://${node.ip_address}:${8000}` : undefined

      const res = await axios.post("http://localhost:8000/api/training/start", {
        model_id: Number(params.id), // Assuming model_id maps to project_id for simplicity in this demo
        ...config,
        node_url: nodeUrl
      })
      setJobId(res.data.job_id)
      setTrainingStatus({ status: "queued" })
    } catch (error) {
      console.error("Failed to start training", error)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Start Training</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model Architecture</Label>
              <Select 
                value={config.model_architecture} 
                onValueChange={(v) => setConfig({...config, model_architecture: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select architecture" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yolov8n">YOLOv8 Nano</SelectItem>
                  <SelectItem value="yolov8s">YOLOv8 Small</SelectItem>
                  <SelectItem value="rf-detr">RF-DETR (Transformer)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Training Node</Label>
              <Select value={selectedNode} onValueChange={setSelectedNode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a node" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Server (This Machine)</SelectItem>
                  {nodes.map(node => (
                    <SelectItem key={node.id} value={node.id.toString()}>
                      {node.name} ({node.has_gpu ? node.gpu_name : "CPU"}) - {node.is_active ? "Active" : "Offline"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Epochs</Label>
              <Input 
                type="number" 
                value={config.epochs} 
                onChange={(e) => setConfig({...config, epochs: Number(e.target.value)})}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Batch Size</Label>
              <Input 
                type="number" 
                value={config.batch_size} 
                onChange={(e) => setConfig({...config, batch_size: Number(e.target.value)})}
              />
            </div>
          </div>

          <Button onClick={startTraining} disabled={!!jobId}>
            {jobId ? "Training in Progress..." : "Start Training"}
          </Button>
        </CardContent>
      </Card>

      {trainingStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Status: {trainingStatus.status}</span>
              <span>Epoch: {trainingStatus.epoch || 0}/{config.epochs}</span>
            </div>
            <Progress value={(trainingStatus.epoch || 0) / config.epochs * 100} />
            
            {/* Metrics Chart Placeholder */}
            <div className="h-64 bg-muted rounded flex items-center justify-center">
              Training Metrics Chart
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
