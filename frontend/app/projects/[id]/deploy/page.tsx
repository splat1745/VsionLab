"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Code, Download, Terminal } from "lucide-react"

export default function DeployPage() {
  const params = useParams()
  const [format, setFormat] = useState("onnx")

  const handleExport = async () => {
    // Call export API
    console.log("Exporting as", format)
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle>Export Model</CardTitle>
            <CardDescription>Download your model for local deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onnx">ONNX (Universal)</SelectItem>
                  <SelectItem value="torchscript">TorchScript (PyTorch)</SelectItem>
                  <SelectItem value="tensorrt">TensorRT (NVIDIA)</SelectItem>
                  <SelectItem value="tflite">TFLite (Mobile)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport} className="w-full">
              <Download className="mr-2 h-4 w-4" /> Export Model
            </Button>
          </CardContent>
        </Card>

        {/* Inference Card */}
        <Card>
          <CardHeader>
            <CardTitle>Test Inference</CardTitle>
            <CardDescription>Drag and drop an image to test.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
              Drop image here
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Snippets */}
      <Card>
        <CardHeader>
          <CardTitle>Use via API</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="python">
            <TabsList>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
            </TabsList>
            <TabsContent value="python" className="mt-4">
              <div className="bg-muted p-4 rounded-md font-mono text-sm">
                <pre>{`import requests

url = "http://localhost:8000/api/infer"
files = {'file': open('image.jpg', 'rb')}
data = {'model_id': '${params.id}'}

response = requests.post(url, files=files, data=data)
print(response.json())`}</pre>
              </div>
            </TabsContent>
            <TabsContent value="curl" className="mt-4">
              <div className="bg-muted p-4 rounded-md font-mono text-sm">
                <pre>{`curl -X POST "http://localhost:8000/api/infer" \\
  -F "file=@image.jpg" \\
  -F "model_id=${params.id}"`}</pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
