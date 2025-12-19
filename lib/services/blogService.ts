import { db } from "@/lib/db";
import { posts, postCategories, comments, postLikes, categories } from "@/lib/db/schema/schema";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import slugify from "slugify";
import { eq, and, or, ilike, inArray, SQL, desc, sql } from "drizzle-orm";
import { CreatePostInput, UpdatePostInput, POST_STATUS } from "@/lib/validations/blog";

// Helper type for status since it's an enum in Zod but string in DB
type PostStatus = (typeof POST_STATUS)[number];

export class BlogService {
    /**
     * Generates a collision-resistant slug by checking the database.
     * Note: This checks outside the transaction initially, but slug uniqueness constraint 
     * in DB should handle final race conditions if strictly enforced.
     */
    private static async generateUniqueSlug(title: string): Promise<string> {
        const baseSlug = slugify(title, {
            lower: true,
            strict: true,
        });

        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const existing = await db.query.posts.findFirst({
                where: eq(posts.slug, slug),
            });

            if (!existing) break;

            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }

    static async createPost(params: CreatePostInput) {
        return await db.transaction(async (tx) => {
            // 1. Handle Image Upload
            let finalCoverImage = params.coverImage;

            if (params.coverImageBase64) {
                try {
                    finalCoverImage = await uploadImageToCloudinary(
                        params.coverImageBase64,
                        params.coverImageType || "image/jpeg"
                    );
                } catch (error) {
                    // Log error and throw distinct message to be caught by API
                    console.error("Cloudinary upload failed:", error);
                    throw new Error("Failed to upload cover image");
                }
            }

            // 2. Generate Slug
            const slug = await this.generateUniqueSlug(params.title);

            // 3. Insert Post
            const [newPost] = await tx
                .insert(posts)
                .values({
                    title: params.title,
                    slug,
                    content: params.content,
                    excerpt: params.excerpt || null,
                    coverImage: finalCoverImage || null,
                    status: params.status as PostStatus,
                    authorId: params.authorId,
                })
                .returning();

            // 4. Link Categories
            if (params.categoryIds && params.categoryIds.length > 0) {
                const categoryValues = params.categoryIds.map((categoryId) => ({
                    postId: newPost.id,
                    categoryId,
                }));
                await tx.insert(postCategories).values(categoryValues);
            }

            // Return basic post info or fetch full (in tx)
            return newPost;
        });
        // Note: Caller can fetch full post if needed, separating concerns.
    }

    static async getPostBySlug(slug: string, userId?: string) {
        const post = await db.query.posts.findFirst({
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
            },
        });

        if (!post) return null;

        let hasLiked = false;
        if (userId) {
            const like = await db.query.postLikes.findFirst({
                where: and(eq(postLikes.postId, post.id), eq(postLikes.userId, userId)),
            });
            hasLiked = !!like;
        }

        return { ...post, hasLiked };
    }

    static async updatePost(slug: string, params: UpdatePostInput) {
        return await db.transaction(async (tx) => {
            // 1. Find existing post
            const existingPost = await tx.query.posts.findFirst({
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
                } catch (error) {
                    console.error("Cloudinary upload failed:", error);
                    throw new Error("Failed to upload cover image");
                }
            }

            // 3. Handle Slug change
            // newTitle was unused, removing it.
            const newSlug = params.title && params.title !== existingPost.title
                ? await this.generateUniqueSlug(params.title)
                : existingPost.slug;

            // 4. Update Post
            // Build update object based on inputs to avoid overwriting with undefined
            // Using Partial<typeof posts.$inferInsert> or similar would be better, but 'any' with manual checks works for now if lint allows.
            // Alternatively, define a partial interface.
            const updateData: Record<string, unknown> = {
                updatedAt: new Date(),
            };
            if (params.title) {
                updateData.title = params.title;
                updateData.slug = newSlug;
            }
            if (params.content) updateData.content = params.content;
            if (params.excerpt !== undefined) updateData.excerpt = params.excerpt;
            updateData.coverImage = finalCoverImage;
            if (params.status) updateData.status = params.status;

            const [updatedPost] = await tx
                .update(posts)
                .set(updateData)
                .where(eq(posts.slug, slug))
                .returning();

            // 5. Update Categories
            if (params.categoryIds && Array.isArray(params.categoryIds)) {
                await tx.delete(postCategories).where(eq(postCategories.postId, existingPost.id));

                if (params.categoryIds.length > 0) {
                    const categoryValues = params.categoryIds.map((categoryId) => ({
                        postId: existingPost.id,
                        categoryId,
                    }));
                    await tx.insert(postCategories).values(categoryValues);
                }
            }

            return updatedPost;
        });
    }

    static async deletePost(slug: string) {
        return await db.transaction(async (tx) => {
            const post = await tx.query.posts.findFirst({
                where: eq(posts.slug, slug),
            });

            if (!post) {
                throw new Error("Blog post not found");
            }

            // Delete cascade within transaction
            await tx.delete(postCategories).where(eq(postCategories.postId, post.id));
            await tx.delete(comments).where(eq(comments.postId, post.id));
            await tx.delete(postLikes).where(eq(postLikes.postId, post.id));
            await tx.delete(posts).where(eq(posts.id, post.id));

            return true;
        });
    }

    static async getAllPosts(filters: { status?: PostStatus; authorId?: string; categorySlug?: string; search?: string } = {}) {
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

        if (filters.search) {
            const searchPattern = `%${filters.search}%`;
            const searchCondition = or(
                ilike(posts.title, searchPattern),
            );
            if (searchCondition) {
                whereConditions.push(searchCondition);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryOptions: any = {
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
        };

        if (whereConditions.length > 0) {
            queryOptions.where = and(...whereConditions);
        }

        return await db.query.posts.findMany(queryOptions);
    }

    static async likePost(userId: string, postId: string) {
        // Check if already liked to avoid errors even if DB constraint exists
        const existingLike = await db.query.postLikes.findFirst({
            where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
        });

        if (existingLike) {
            return; // Already liked
        }

        // Insert like with explicit date to avoid driver serialization issues
        await db.insert(postLikes).values({
            postId,
            userId,
            createdAt: new Date(),
        });

        // Increment like count and update timestamp
        await db
            .update(posts)
            .set({
                likeCount: sql`${posts.likeCount} + 1`,
                updatedAt: new Date(),
            })
            .where(eq(posts.id, postId));
    }

    static async unlikePost(userId: string, postId: string) {
        const deleted = await db
            .delete(postLikes)
            .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
            .returning();

        if (deleted.length > 0) {
            // Decrement like count and update timestamp
            await db
                .update(posts)
                .set({
                    // Ensure we don't go below 0 (though app logic should prevent this)
                    likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)`,
                    updatedAt: new Date(),
                })
                .where(eq(posts.id, postId));
        }
    }

    static async getPostLikeStatus(postId: string, userId?: string) {
        const post = await db.query.posts.findFirst({
            where: eq(posts.id, postId),
            columns: {
                likeCount: true,
            },
        });

        let hasLiked = false;
        if (userId) {
            const like = await db.query.postLikes.findFirst({
                where: and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)),
            });
            hasLiked = !!like;
        }

        return {
            likeCount: post?.likeCount || 0,
            hasLiked,
        };
    }
}
