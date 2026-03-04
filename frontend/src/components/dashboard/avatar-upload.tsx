"use client"

import { useState, useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AvatarUploadProps {
  currentUrl: string
  initials: string
  onUpload: (url: string) => void
}

export function AvatarUpload({ currentUrl, initials, onUpload }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("upload_preset", "documind") // create this preset in Cloudinary dashboard
    formData.append("folder", "avatars")

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      )
      const data = await res.json()
      const url = data.secure_url
      setPreview(url)
      onUpload(url)
    } catch (err) {
      console.error("Upload failed:", err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative w-fit">
      <Avatar className="h-20 w-20">
        <AvatarImage src={preview} />
        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Upload button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary transition-opacity hover:opacity-90",
          uploading && "opacity-70 cursor-not-allowed"
        )}
      >
        {uploading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
          : <Camera className="h-3.5 w-3.5 text-primary-foreground" />
        }
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}