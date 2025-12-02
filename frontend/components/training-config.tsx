"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Play, Square, AlertCircle } from "lucide-react"
import axios from "axios"
import { useState } from "react"

type TrainingConfigProps = {
  projectId: number
  onStart?: () => void
}

export function TrainingConfig({ projectId, onStart }: TrainingConfigProps) {
  const [model, setModel] = useState("yolov8n")
  const [epochs, setEpochs] = useState(100)
  const [batchSize, setBatchSize] = useState(16)
  const [imgSize, setImgSize] = useState(640)
  const [isTraining, setIsTraining] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentEpoch, setCurrentEpoch] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)

  const startTraining = async () => {
    try {
      const res = await axios.post(`http://localhost:8000/api/projects/${projectId}/train`, {
        model_architecture: model,
        epochs,
        batch_size: batchSize,
        img_size: imgSize
      })
      setJobId(res.data.job_id)
      setIsTraining(true)
      onStart?.()
      
      // Start polling for progress
      pollTrainingProgress(res.data.job_id)
    } catch (error) {
      console.error("Failed to start training:", error)
    }
  }

  const pollTrainingProgress = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8000/api/training/${id}/status`)
        setProgress(res.data.progress)
        setCurrentEpoch(res.data.current_epoch)
        
        if (res.data.status === "complete" || res.data.status === "failed") {
          clearInterval(interval)
          setIsTraining(false)
        }
      } catch (error) {
        clearInterval(interval)
      }
    }, 2000)
  }

  const stopTraining = async () => {
    if (!jobId) return
    try {
      await axios.post(`http://localhost:8000/api/training/${jobId}/stop`)
      setIsTraining(false)
    } catch (error) {
      console.error("Failed to stop training:", error)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Model Configuration</CardTitle>
          <CardDescription>Configure your training parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Model Architecture</Label>
              <Select value={model} onValueChange={setModel} disabled={isTraining}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yolov8n">YOLOv8 Nano (fastest)</SelectItem>
                  <SelectItem value="yolov8s">YOLOv8 Small</SelectItem>
                  <SelectItem value="yolov8m">YOLOv8 Medium</SelectItem>
                  <SelectItem value="yolov8l">YOLOv8 Large</SelectItem>
                  <SelectItem value="rfdetr">RF-DETR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Image Size</Label>
              <Select value={imgSize.toString()} onValueChange={(v) => setImgSize(parseInt(v))} disabled={isTraining}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="320">320x320</SelectItem>
                  <SelectItem value="416">416x416</SelectItem>
                  <SelectItem value="640">640x640 (recommended)</SelectItem>
                  <SelectItem value="1280">1280x1280</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Epochs: {epochs}</Label>
            <Slider
              value={[epochs]}
              onValueChange={(val) => setEpochs(val[0])}
              min={10}
              max={300}
              step={10}
              disabled={isTraining}
            />
          </div>

          <div>
            <Label>Batch Size: {batchSize}</Label>
            <Slider
              value={[batchSize]}
              onValueChange={(val) => setBatchSize(val[0])}
              min={2}
              max={64}
              step={2}
              disabled={isTraining}
            />
          </div>
        </CardContent>
      </Card>

      {isTraining && (
        <Card>
          <CardHeader>
            <CardTitle>Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Epoch {currentEpoch} / {epochs}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {!isTraining ? (
          <Button onClick={startTraining} className="flex-1">
            <Play className="mr-2 h-4 w-4" />
            Start Training
          </Button>
        ) : (
          <Button onClick={stopTraining} variant="destructive" className="flex-1">
            <Square className="mr-2 h-4 w-4" />
            Stop Training
          </Button>
        )}
      </div>
    </div>
  )
}
