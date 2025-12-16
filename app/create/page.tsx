"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/shared/loader";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProtectedRoute from "@/components/ProtectedRoute";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";
import { RichTextEditor } from "@/components/RichTextEditor";
import { blogApi } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { BlogPayload } from "@/lib/types";
import { CoverImageUpload } from "@/components/blog/CoverImageUpload";
import { CategorySelector } from "@/components/blog/CategorySelector";

export default function CreateBlog() {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const router = useRouter();
  const { data: session } = useSession();

  const handleImageChange = (file: File | null, previewUrl: string | null) => {
    setCoverImageFile(file);
    setCoverImage(previewUrl);
  };

  const getNameOfCategory = (id: string) =>
    categories.find((c) => c.id === id)?.name;

  const handleSubmit = async (status: "draft" | "published") => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (title.length < 5) {
      toast.error("Title must be at least 5 characters");
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter content");
      return;
    }

    if (content.length < 50) {
      toast.error("Content must be at least 50 characters");
      return;
    }

    try {
      if (status === "draft") {
        setSavingDraft(true);
      } else {
        setPublishing(true);
      }

      const createBlog = async (imageBase64?: string) => {
        const payload: BlogPayload = {
          title,
          excerpt: excerpt.trim() || undefined,
          content,
          status,
          categoryIds: selectedCategories,
        };

        if (imageBase64 && coverImageFile) {
          payload.coverImageBase64 = imageBase64;
          payload.coverImageType = coverImageFile.type;
        }

        const response = await blogApi.createBlog(payload);
        toast.success(
          status === "draft"
            ? "Draft saved successfully!"
            : "Blog published successfully!"
        );

        setTimeout(() => {
          router.push(`/blog/${response.post.slug}`);
        }, 1000);
      };

      if (coverImageFile) {
        // Prepare Base64 logic, though ideally this could also be moved to a util
        const reader = new FileReader();
        reader.onloadend = async () => {
          if (reader.result) {
            await createBlog(reader.result as string);
          }
        };
        reader.onerror = () => {
          toast.error("Failed to read image file");
          setSavingDraft(false);
          setPublishing(false);
        };
        reader.readAsDataURL(coverImageFile);
      } else {
        await createBlog();
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create blog"
      );
      setSavingDraft(false);
      setPublishing(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <Toaster position="top-right" />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Create New Blog</h1>
                <p className="text-muted-foreground mt-2">
                  Share your thoughts with the world
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPreview(!preview)}
                  className="gap-2"
                >
                  {preview ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Preview
                    </>
                  )}
                </Button>
              </div>
            </div>

            {!preview ? (
              <div className="space-y-6">
                <CoverImageUpload
                  coverImage={coverImage}
                  onImageChange={handleImageChange}
                />

                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Enter blog title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {title.length}/200 characters
                  </p>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    Excerpt (Optional)
                  </label>
                  <Textarea
                    placeholder="Brief summary of your blog..."
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={3}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {excerpt.length}/500 characters
                  </p>
                </div>

                <CategorySelector
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                  onCategoriesLoaded={setCategories}
                />

                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    Content <span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor content={content} onChange={setContent} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {content.length} characters (minimum 50 required)
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit("draft")}
                    disabled={savingDraft || publishing}
                  >
                    {savingDraft ? (
                      <>
                        <Loader className="w-4 h-4 mr-2" size="sm" />
                        Saving...
                      </>
                    ) : (
                      "Save Draft"
                    )}
                  </Button>
                  <Button
                    onClick={() => handleSubmit("published")}
                    disabled={savingDraft || publishing}
                  >
                    {publishing ? (
                      <>
                        <Loader className="w-4 h-4 mr-2" size="sm" />
                        Publishing...
                      </>
                    ) : (
                      "Publish Blog"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {coverImage && (
                  <div className="rounded-lg overflow-hidden">
                    <Image
                      src={coverImage}
                      alt="Cover preview"
                      width={1200}
                      height={630}
                      className="w-full h-64 object-cover"
                    />
                  </div>
                )}
                <div className="bg-secondary rounded-lg p-8 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Preview</p>
                    <h2 className="text-3xl font-bold">
                      {title || "Your blog title"}
                    </h2>
                  </div>
                  {excerpt && (
                    <p className="text-muted-foreground text-lg">{excerpt}</p>
                  )}
                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCategories.map((id) => (
                        <Badge key={id} variant="outline">
                          {getNameOfCategory(id)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    {session?.user?.image && (
                      <Image
                        src={session.user.image}
                        alt={session.user.name || "Author"}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{session?.user?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="prose prose-sm md:prose-base max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{
                    __html: content || "Your blog content will appear here",
                  }}
                />
              </div>
            )}
          </motion.div>
        </main>

        <Footer />
      </div>
    </ProtectedRoute>
  );
}
