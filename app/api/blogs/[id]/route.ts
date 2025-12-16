
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { BlogService } from "@/lib/services/blogService";

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

    const post = await BlogService.getPostBySlug(id);

    if (!post) {
      return NextResponse.json(
        { error: "Blog post not found" },
        { status: 404 }
      );
    }

    // Only return published posts or drafts if requested by author
    if (post.status === "draft") {
      const session = await getAuthSession();
      if (!session || post.authorId !== session.user.id) {
        return NextResponse.json(
          { error: "Blog post not found" },
          { status: 404 }
        );
      }
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

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (body.title.length < 5) {
      return NextResponse.json(
        { error: "Title must be at least 5 characters" },
        { status: 400 }
      );
    }

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

    const updatedPost = await BlogService.updatePost(id, {
      title: body.title,
      content: body.content,
      excerpt: body.excerpt,
      status: body.status || "published",
      authorId: session.user.id,
      categoryIds: body.categoryIds,
      coverImage: body.coverImage,
      coverImageBase64: body.coverImageBase64,
      coverImageType: body.coverImageType
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
    console.error("Error updating blog post:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update blog post"
      },
      { status: 500 }
    );
  }
}