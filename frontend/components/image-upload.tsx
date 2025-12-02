"use client"

import * as React from "react"
import { Upload, X, Image as ImageIcon, CheckCircle } from "lucide-react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import type { StorageLocation } from "./storage-selector"

type ImageUploadProps = {
  projectId: number
  storageLocation: StorageLocation
  onComplete: () => void
}

type UploadFile = {
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
}

export function ImageUpload({ projectId, storageLocation, onComplete }: ImageUploadProps) {
  const [files, setFiles] = React.useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    )

    addFiles(droppedFiles)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending'
    }))

    setFiles((prev) => [...prev, ...uploadFiles])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const uploadFiles = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue

      setFiles((prev) => {
        const updated = [...prev]
        updated[i].status = 'uploading'
        return updated
      })

      try {
        const formData = new FormData()
        formData.append('file', files[i].file)
        formData.append('storage_type', storageLocation.type)
        if (storageLocation.path) {
          formData.append('storage_path', storageLocation.path)
        }

        await axios.post(
          `http://localhost:8000/api/projects/${projectId}/images`,
          formData,
          {
            onUploadProgress: (progressEvent) => {
              const progress = progressEvent.total
                ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                : 0
              setFiles((prev) => {
                const updated = [...prev]
                updated[i].progress = progress
                return updated
              })
            }
          }
        )

        setFiles((prev) => {
          const updated = [...prev]
          updated[i].status = 'complete'
          return updated
        })
      } catch (error) {
        console.error('Upload failed:', error)
        setFiles((prev) => {
          const updated = [...prev]
          updated[i].status = 'error'
          return updated
        })
      }
    }

    // Check if all uploads are complete
    if (files.every((f) => f.status === 'complete')) {
      setTimeout(onComplete, 1000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">Drag & drop images here</p>
        <p className="text-sm text-muted-foreground mb-4">or</p>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {files.length} image{files.length !== 1 ? 's' : ''} selected
            </h3>
            <Button
              onClick={uploadFiles}
              disabled={files.every((f) => f.status !== 'pending' && f.status !== 'error')}
            >
              Upload All
            </Button>
          </div>

          <div className="grid gap-2 max-h-96 overflow-y-auto">
            {files.map((uploadFile, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={uploadFile.preview}
                      alt={uploadFile.file.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="mt-1" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadFile.status === 'complete' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {uploadFile.status === 'error' && (
                        <span className="text-xs text-red-500">Failed</span>
                      )}
                      {uploadFile.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
