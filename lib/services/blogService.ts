import { db } from "@/lib/db";
import { posts, postCategories, comments, postLikes, categories } from "@/lib/db/schema/schema";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import slugify from "slugify";
import { eq, and, inArray, SQL, desc } from "drizzle-orm";

export interface CreatePostParams {
    title: string;
    content: string;
    excerpt?: string;
    coverImage?: string; // URL if already uploaded
    coverImageBase64?: string; // For new uploads
    coverImageType?: string;
    status: "draft" | "published";
    authorId: string;
    categoryIds?: string[];
}

export class BlogService {
    /**
     * Generates a collision-resistant slug.
     * Format: my-blog-title-x9d2s
     */
    private static generateSlug(title: string): string {
        const baseSlug = slugify(title, {
            lower: true,
            strict: true,
        });
        // Simple random string generator to avoid ESM issues with nanoid in Jest
        const suffix = Math.random().toString(36).substring(2, 7);
        return `${baseSlug}-${suffix}`;
    }

    static async createPost(params: CreatePostParams) {
        // 1. Handle Image Upload
        let finalCoverImage = params.coverImage;

        if (params.coverImageBase64) {
            try {
                finalCoverImage = await uploadImageToCloudinary(
                    params.coverImageBase64,
                    params.coverImageType || "image/jpeg"
                );
            } catch (error) {
                throw new Error("Failed to upload cover image", error as Error);
            }
        }

        // 2. Generate Slug
        const slug = this.generateSlug(params.title);

        // 3. Insert Post
        const [newPost] = await db
            .insert(posts)
            .values({
                title: params.title,
                slug,
                content: params.content,
                excerpt: params.excerpt || null,
                coverImage: finalCoverImage || null,
                status: params.status,
                authorId: params.authorId,
            })
            .returning();

        // 4. Link Categories
        if (params.categoryIds && params.categoryIds.length > 0) {
            const categoryValues = params.categoryIds.map((categoryId) => ({
                postId: newPost.id,
                categoryId,
            }));
            await db.insert(postCategories).values(categoryValues);
        }

        // 5. Return complete post
        const completePost = await db.query.posts.findFirst({
            where: eq(posts.id, newPost.id),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                postCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        });

        return completePost;
    }

    static async getPostBySlug(slug: string) {
        return await db.query.posts.findFirst({
            where: eq(posts.slug, slug),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                postCategories: {
                    with: {
                        category: true,
                    },
                },
                comments: {
                    with: {
                        author: {
                            columns: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                        replies: {
                            with: {
                                author: {
                                    columns: {
                                        id: true,
                                        name: true,
                                        image: true,
                                    },
                                },
                            },
                        },
                    },
                },
                likes: true,
            },
        });
    }

    static async updatePost(slug: string, params: CreatePostParams) {
        // 1. Find existing post
        const existingPost = await db.query.posts.findFirst({
            where: eq(posts.slug, slug),
        });

        if (!existingPost) {
            throw new Error("Blog post not found");
        }

        // 2. Handle cover image
        let finalCoverImage = params.coverImage || existingPost.coverImage;
        if (params.coverImageBase64) {
            try {
                finalCoverImage = await uploadImageToCloudinary(
                    params.coverImageBase64,
                    params.coverImageType || "image/jpeg"
                );
            } catch (error: unknown) {
                if (error instanceof Error) {
                    throw new Error("Failed to upload cover image");
                }
            }
        }

        // 3. Handle Slug change
        const newSlug = params.title !== existingPost.title
            ? this.generateSlug(params.title)
            : existingPost.slug;

        // 4. Update Post
        const [updatedPost] = await db
            .update(posts)
            .set({
                title: params.title,
                slug: newSlug,
                content: params.content,
                excerpt: params.excerpt || null,
                coverImage: finalCoverImage,
                status: params.status,
                updatedAt: new Date(),
            })
            .where(eq(posts.slug, slug))
            .returning();

        // 5. Update Categories
        if (params.categoryIds && Array.isArray(params.categoryIds)) {
            await db.delete(postCategories).where(eq(postCategories.postId, existingPost.id));

            if (params.categoryIds.length > 0) {
                const categoryValues = params.categoryIds.map((categoryId) => ({
                    postId: existingPost.id,
                    categoryId,
                }));
                await db.insert(postCategories).values(categoryValues);
            }
        }

        // 6. Return complete post
        return await db.query.posts.findFirst({
            where: eq(posts.id, updatedPost.id),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                postCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        });
    }

    static async deletePost(slug: string) {
        const post = await db.query.posts.findFirst({
            where: eq(posts.slug, slug),
        });

        if (!post) {
            throw new Error("Blog post not found");
        }

        // Delete cascade
        await db.delete(postCategories).where(eq(postCategories.postId, post.id));
        await db.delete(comments).where(eq(comments.postId, post.id));
        await db.delete(postLikes).where(eq(postLikes.postId, post.id));
        await db.delete(posts).where(eq(posts.id, post.id)); // Delete by ID is safer

        return true;
    }

    static async getAllPosts(filters: { status?: "draft" | "published"; authorId?: string; categorySlug?: string } = {}) {
        const whereConditions: SQL[] = [];

        if (filters.status) {
            whereConditions.push(eq(posts.status, filters.status));
        }

        if (filters.authorId) {
            whereConditions.push(eq(posts.authorId, filters.authorId));
        }

        if (filters.categorySlug) {
            const subquery = db.select({ postId: postCategories.postId })
                .from(postCategories)
                .leftJoin(categories, eq(postCategories.categoryId, categories.id))
                .where(eq(categories.slug, filters.categorySlug));

            whereConditions.push(inArray(posts.id, subquery));
        }

        return await db.query.posts.findMany({
            where: and(...whereConditions),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
                postCategories: {
                    with: {
                        category: true,
                    },
                },
            },
            orderBy: [desc(posts.createdAt)],
        });
    }
}
