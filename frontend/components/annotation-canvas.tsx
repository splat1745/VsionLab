"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Save, Trash2, ZoomIn, ZoomOut, Move } from "lucide-react"
import axios from "axios"

type BoundingBox = {
  id: string
  x: number
  y: number
  width: number
  height: number
  classId: number
  className: string
  color: string
}

type AnnotationCanvasProps = {
  projectId: number
  imageId: number
  imageSrc: string
  classes: { id: number; name: string; color: string }[]
  onSave?: () => void
}

export function AnnotationCanvas({
  projectId,
  imageId,
  imageSrc,
  classes,
  onSave
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [boxes, setBoxes] = useState<BoundingBox[]>([])
  const [selectedClass, setSelectedClass] = useState<number>(classes[0]?.id || 0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    loadAnnotations()
  }, [imageId])

  useEffect(() => {
    drawCanvas()
  }, [boxes, zoom, pan, currentBox])

  const loadAnnotations = async () => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/images/${imageId}/annotations`
      )
      const loadedBoxes: BoundingBox[] = res.data.map((ann: any) => {
        // Extract bbox data from the 'data' field
        const data = ann.data || {}
        return {
          id: ann.id.toString(),
          x: data.x || 0,
          y: data.y || 0,
          width: data.width || 0,
          height: data.height || 0,
          classId: ann.class_id,
          className: ann.class_name || classes.find((c) => c.id === ann.class_id)?.name || "Unknown",
          color: ann.class_color || classes.find((c) => c.id === ann.class_id)?.color || "#FF0000"
        }
      })
      setBoxes(loadedBoxes)
    } catch (error) {
      console.error("Failed to load annotations:", error)
    }
  }

  const drawCanvas = () => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image || !image.complete) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply transformations
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Draw image
    ctx.drawImage(image, 0, 0, image.width, image.height)

    // Draw saved boxes
    boxes.forEach((box) => {
      ctx.strokeStyle = box.color
      ctx.lineWidth = 2 / zoom
      ctx.strokeRect(box.x, box.y, box.width, box.height)

      // Draw label
      ctx.fillStyle = box.color
      ctx.fillRect(box.x, box.y - 20 / zoom, ctx.measureText(box.className).width + 10, 20 / zoom)
      ctx.fillStyle = "#FFFFFF"
      ctx.font = `${12 / zoom}px Arial`
      ctx.fillText(box.className, box.x + 5, box.y - 5 / zoom)
    })

    // Draw current box being drawn
    if (currentBox) {
      const selectedClassData = classes.find((c) => c.id === selectedClass)
      const color = selectedClassData?.color || "#FF0000"
      ctx.strokeStyle = color
      ctx.lineWidth = 2 / zoom
      ctx.setLineDash([5 / zoom, 5 / zoom])
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height)
      ctx.setLineDash([])
    }

    ctx.restore()
  }

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    return { x, y }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.shiftKey) {
      // Pan mode
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    } else {
      // Draw mode
      const coords = getCanvasCoordinates(e)
      setIsDrawing(true)
      setStartPoint(coords)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    } else if (isDrawing && startPoint) {
      const coords = getCanvasCoordinates(e)
      const width = coords.x - startPoint.x
      const height = coords.y - startPoint.y

      const selectedClassData = classes.find((c) => c.id === selectedClass)
      setCurrentBox({
        id: "temp",
        x: Math.min(startPoint.x, coords.x),
        y: Math.min(startPoint.y, coords.y),
        width: Math.abs(width),
        height: Math.abs(height),
        classId: selectedClass,
        className: selectedClassData?.name || "Unknown",
        color: selectedClassData?.color || "#FF0000"
      })
    }
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      setLastPanPoint(null)
    } else if (isDrawing && currentBox && currentBox.width > 10 && currentBox.height > 10) {
      // Only add box if it's significant size
      setBoxes((prev) => [...prev, { ...currentBox, id: `box-${Date.now()}` }])
      setCurrentBox(null)
      setIsDrawing(false)
      setStartPoint(null)
    } else {
      setCurrentBox(null)
      setIsDrawing(false)
      setStartPoint(null)
    }
  }

  const deleteLastBox = () => {
    setBoxes((prev) => prev.slice(0, -1))
  }

  const saveAnnotations = async () => {
    try {
      await axios.post(
        `http://localhost:8000/api/annotations/bulk`,
        {
          image_id: imageId,
          annotations: boxes.map((box) => ({
            class_id: box.classId,
            annotation_type: "bbox",
            data: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height
            }
          }))
        }
      )
      onSave?.()
    } catch (error) {
      console.error("Failed to save annotations:", error)
    }
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="border border-border cursor-crosshair"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Annotation"
                className="hidden"
                onLoad={() => {
                  const img = imageRef.current
                  const canvas = canvasRef.current
                  if (img && canvas) {
                    canvas.width = Math.min(img.width, 800)
                    canvas.height = Math.min(img.height, 600)
                    drawCanvas()
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-64 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Class</label>
              <Select
                value={selectedClass.toString()}
                onValueChange={(val) => setSelectedClass(parseInt(val))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: cls.color }}
                        />
                        {cls.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setZoom((z) => Math.min(z + 0.1, 3))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setZoom((z) => Math.max(z - 0.1, 0.5))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Hold Shift + Drag to pan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Annotations ({boxes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-48 overflow-y-auto space-y-1">
              {boxes.map((box, index) => (
                <div
                  key={box.id}
                  className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: box.color }}
                    />
                    <span>{box.className}</span>
                  </div>
                  <Badge variant="outline">{index + 1}</Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={deleteLastBox}
                disabled={boxes.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button size="sm" className="flex-1" onClick={saveAnnotations}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
