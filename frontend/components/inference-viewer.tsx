"use client"

import * as React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2 } from "lucide-react"
import axios from "axios"

type InferenceViewerProps = {
  projectId: number
  models: { id: number; name: string; architecture: string }[]
}

export function InferenceViewer({ projectId, models }: InferenceViewerProps) {
  const [selectedModel, setSelectedModel] = useState(models[0]?.id?.toString() || "")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [results, setResults] = useState<any>(null)
  const [isInferring, setIsInferring] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
      setResults(null)
    }
  }

  const runInference = async () => {
    if (!imageFile || !selectedModel) return

    setIsInferring(true)
    try {
      const formData = new FormData()
      formData.append("file", imageFile)
      formData.append("model_id", selectedModel)

      const res = await axios.post(`http://localhost:8000/api/inference`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })

      setResults(res.data)
      drawResults(res.data)
    } catch (error) {
      console.error("Inference failed:", error)
    } finally {
      setIsInferring(false)
    }
  }

  const drawResults = (data: any) => {
    const canvas = canvasRef.current
    const img = new Image()
    img.src = imagePreview!

    img.onload = () => {
      if (!canvas) return
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      ctx.drawImage(img, 0, 0)

      // Draw detections
      data.detections?.forEach((det: any) => {
        ctx.strokeStyle = det.color || "#00FF00"
        ctx.lineWidth = 3
        ctx.strokeRect(det.x, det.y, det.width, det.height)

        // Draw label
        ctx.fillStyle = det.color || "#00FF00"
        const label = `${det.class_name} ${(det.confidence * 100).toFixed(1)}%`
        const metrics = ctx.measureText(label)
        ctx.fillRect(det.x, det.y - 25, metrics.width + 10, 25)
        ctx.fillStyle = "#FFFFFF"
        ctx.font = "14px Arial"
        ctx.fillText(label, det.x + 5, det.y - 7)
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inference Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a trained model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id.toString()}>
                    {model.name} ({model.architecture})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Upload Image</Label>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {imageFile ? imageFile.name : "Click to upload an image"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <Button
            onClick={runInference}
            disabled={!imageFile || !selectedModel || isInferring}
            className="w-full"
          >
            {isInferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Inference...
              </>
            ) : (
              "Run Inference"
            )}
          </Button>
        </CardContent>
      </Card>

      {imagePreview && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <canvas ref={canvasRef} className="w-full border rounded" />
            {results && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">
                  Detections: {results.detections?.length || 0}
                </p>
                {results.detections?.map((det: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                    <span>{det.class_name}</span>
                    <span className="text-muted-foreground">
                      {(det.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
