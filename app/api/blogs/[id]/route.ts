import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { BlogService } from "@/lib/services/blogService";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { updatePostSchema } from "@/lib/validations/blog";
import { ZodError } from "zod";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    const session = await getAuthSession();
    const post = await BlogService.getPostBySlug(id, session?.user?.id);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }



    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error("Fetch blog error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blog post" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Find the blog post
    const post = await BlogService.getPostBySlug(id);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    // Check if the current user is the author of the blog
    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own blog posts" },
        { status: 403 }
      );
    }

    await BlogService.deletePost(id);

    return NextResponse.json(
      { success: true, message: "Blog post deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting blog post:", error);

    return NextResponse.json(
      { error: "Failed to delete blog post" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAuthSession();

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // VALIDATION: Parse input specific to updates
    const validatedData = updatePostSchema.parse(body);

    // Find the blog post by ID (not slug)
    const post = await BlogService.getPostBySlug(id);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (post.authorId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only edit your own blog posts" },
        { status: 403 }
      );
    }

    // HANDLE IMAGE UPLOAD
    if (validatedData.coverImageBase64) {
      try {
        const imageUrl = await uploadImageToCloudinary(
          validatedData.coverImageBase64,
          validatedData.coverImageType || "image/jpeg"
        );
        validatedData.coverImage = imageUrl;
      } catch (error) {
        console.error("Cloudinary upload failed:", error);
        return NextResponse.json(
          { error: "Failed to upload cover image", code: "UPLOAD_ERROR" },
          { status: 400 }
        );
      }
    }

    const updatedPost = await BlogService.updatePost(id, {
      ...validatedData,
      authorId: session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Blog post updated successfully",
        post: updatedPost
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", code: "VALIDATION_ERROR", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Error updating blog post:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update blog post"
      },
      { status: 500 }
    );
  }
}