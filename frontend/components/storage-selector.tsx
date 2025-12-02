"use client"

import * as React from "react"
import { Folder, HardDrive, Link as LinkIcon, Cloud } from "lucide-react"
import {  
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type StorageLocation = {
  type: 'project' | 'custom' | 'existing' | 'external'
  path?: string
  projectId?: number
}

type StorageSelectorProps = {
  open: boolean
  onClose: () => void
  onSelect: (location: StorageLocation) => void
  projectId: number
}

export function StorageSelector({ open, onClose, onSelect, projectId }: StorageSelectorProps) {
  const [customPath, setCustomPath] = React.useState("")
  const [selectedType, setSelectedType] = React.useState<StorageLocation['type']>('project')

  const handleSelect = () => {
    const location: StorageLocation = {
      type: selectedType,
      projectId,
      path: selectedType === 'custom' ? customPath : undefined
    }
    onSelect(location)
    onClose()
  }

  const storageOptions = [
    {
      type: 'project' as const,
      title: 'Project Folder',
      description: `Store in data/projects/${projectId}/images`,
      icon: Folder,
      recommended: true
    },
    {
      type: 'custom' as const,
      title: 'Custom Directory',
      description: 'Choose any folder on your system',
      icon: HardDrive,
      recommended: false
    },
    {
      type: 'existing' as const,
      title: 'Existing Dataset',
      description: 'Link to images already on disk (symbolic links)',
      icon: LinkIcon,
      recommended: false
    },
    {
      type: 'external' as const,
      title: 'External Storage',
      description: 'Network drive or external location',
      icon: Cloud,
      recommended: false
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Storage Location</DialogTitle>
          <DialogDescription>
            Choose where to store your project images. You can change this later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {storageOptions.map((option) => {
            const Icon = option.icon
            return (
              <Card
                key={option.type}
                className={`cursor-pointer transition-all ${
                  selectedType === option.type
                    ? 'border-primary ring-2 ring-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedType(option.type)}
              >
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {option.title}
                      {option.recommended && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{option.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            )
          })}

          {selectedType === 'custom' && (
            <div className="grid gap-2 animate-fade-in">
              <Label htmlFor="custom-path">Custom Path</Label>
              <Input
                id="custom-path"
                placeholder="C:\Users\YourName\MyDatasets"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={selectedType === 'custom' && !customPath.trim()}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
