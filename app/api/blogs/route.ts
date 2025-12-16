import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { db } from "@/lib/db";
import { createBlogSchema } from "@/lib/validations/blog";
import { BlogService } from "@/lib/services/blogService";
import { ZodError } from "zod";

export async function POST(req: Request) {
    try {
        const session = await getAuthSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, session.user.email),
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const body = await req.json();

        // Prepare data for validation
        const dataToValidate = {
            title: body.title,
            excerpt: body.excerpt,
            content: body.content,
            coverImage: undefined, // Image validation happens in service potentially, or we trust the upload logic
            status: body.status,
        };

        const validatedData = createBlogSchema.parse(dataToValidate);

        const newPost = await BlogService.createPost({
            title: validatedData.title,
            content: validatedData.content,
            excerpt: validatedData.excerpt,
            status: validatedData.status,
            authorId: user.id,
            coverImageBase64: body.coverImageBase64,
            coverImageType: body.coverImageType,
            categoryIds: body.categoryIds,
        });

        return NextResponse.json({
            success: true,
            post: newPost,
        });
    } catch (error) {
        console.error("Create blog error:", error);

        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", details: error },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to create blog post" },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const status = (searchParams.get("status") as "draft" | "published") || undefined;
        const authorId = searchParams.get("authorId") || undefined;
        const categorySlug = searchParams.get("category") || undefined;

        const allPosts = await BlogService.getAllPosts({
            status,
            authorId,
            categorySlug
        });

        return NextResponse.json({
            success: true,
            posts: allPosts,
        });
    } catch (error) {
        console.error("Fetch blogs error:", error);
        return NextResponse.json(
            { error: "Failed to fetch blog posts" },
            { status: 500 }
        );
    }
}