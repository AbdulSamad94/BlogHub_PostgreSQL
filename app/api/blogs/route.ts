import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { db } from "@/lib/db";
import { createPostSchema } from "@/lib/validations/blog";
import { BlogService } from "@/lib/services/blogService";
import { ZodError } from "zod";
import { users } from "@/lib/db/schema/schema";
import { eq } from "drizzle-orm";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { ServiceError } from "@/lib/errors";

export async function POST(req: Request) {
    try {
        const session = await getAuthSession();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await db.query.users.findFirst({
            where: eq(users.email, session.user.email),
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const body = await req.json();

        // VALIDATION: Parse entire body against strict Zod schema
        const validatedData = createPostSchema.parse({
            ...body,
            authorId: user.id
        });

        // HANDLE IMAGE UPLOAD (Decoupled from Transaction)
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
                    { error: "Failed to upload cover image" },
                    { status: 400 }
                );
            }
        }

        const newPost = await BlogService.createPost(validatedData);

        return NextResponse.json({
            success: true,
            post: newPost,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", code: "VALIDATION_ERROR", details: error.flatten() },
                { status: 400 }
            );
        }

        if (error instanceof ServiceError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.statusCode }
            );
        }

        console.error("Create blog error:", error);
        return NextResponse.json(
            { error: "Failed to create blog post", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status");

        let status: "draft" | "published" | undefined;
        if (statusParam === "draft" || statusParam === "published") {
            status = statusParam;
        }

        const authorId = searchParams.get("authorId") || undefined;
        const categorySlug = searchParams.get("category") || undefined;
        const search = searchParams.get("search") || undefined;

        const session = await getAuthSession();

        const allPosts = await BlogService.getAllPosts({
            status,
            authorId,
            categorySlug,
            search,
            viewerId: session?.user?.id
        });

        return NextResponse.json({
            success: true,
            posts: allPosts,
        });
    } catch (error) {
        if (error instanceof ServiceError) {
            return NextResponse.json(
                { error: error.message, code: error.code },
                { status: error.statusCode }
            );
        }

        console.error("Fetch blogs error:", error);
        return NextResponse.json(
            { error: "Failed to fetch blog posts", code: "INTERNAL_ERROR" },
            { status: 500 }
        );
    }
}
