"use client";

import { Upload, X } from "lucide-react";
import Image from "next/image";
import { toast } from "react-hot-toast";

interface CoverImageUploadProps {
  coverImage: string | null;
  onImageChange: (file: File | null, previewUrl: string | null) => void;
}

export function CoverImageUpload({
  coverImage,
  onImageChange,
}: CoverImageUploadProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, PNG, WebP, or GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onImageChange(file, reader.result as string);
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
    toast.success("Image selected! It will upload when you publish.");
  };

  const removeCoverImage = () => {
    onImageChange(null, null);
    toast.success("Cover image removed");
  };

  return coverImage ? (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <Image
        src={coverImage}
        alt="Cover"
        width={1200}
        height={630}
        className="w-full h-64 object-cover"
      />
      <button
        type="button"
        onClick={removeCoverImage}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  ) : (
    <label className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition cursor-pointer block">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
      <p className="font-semibold">Upload cover image</p>
      <p className="text-sm text-muted-foreground">
        or drag and drop (Max 5MB)
      </p>
    </label>
  );
}
