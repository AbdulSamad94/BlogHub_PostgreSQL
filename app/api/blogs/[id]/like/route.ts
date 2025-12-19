import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { BlogService } from "@/lib/services/blogService";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: postId } = await params;
        const session = await getAuthSession();

        if (!session || !session.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        const post = await BlogService.getPostBySlug(postId);
        if (!post) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 }
            );
        }

        await BlogService.likePost(session.user.id, post.id);

        return NextResponse.json(
            { success: true, message: "Post liked" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error liking post:", error);
        return NextResponse.json(
            { error: "Failed to like post" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: postId } = await params;
        const session = await getAuthSession();

        if (!session || !session.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const post = await BlogService.getPostBySlug(postId);
        if (!post) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 }
            );
        }

        await BlogService.unlikePost(session.user.id, post.id);

        return NextResponse.json(
            { success: true, message: "Post unliked" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error unliking post:", error);
        return NextResponse.json(
            { error: "Failed to unlike post" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: postId } = await params;
        const session = await getAuthSession();
        // Even if no session, we return count.

        const post = await BlogService.getPostBySlug(postId);
        if (!post) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 }
            );
        }

        const data = await BlogService.getPostLikeStatus(post.id, session?.user?.id);

        return NextResponse.json({
            success: true,
            likeCount: data.likeCount,
            hasLiked: data.hasLiked
        });

    } catch (error) {
        console.error("Error fetching like status:", error);
        return NextResponse.json(
            { error: "Failed to fetch like status" },
            { status: 500 }
        );
    }
}
