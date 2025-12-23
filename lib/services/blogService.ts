import { db } from "@/lib/db";
import { posts, postCategories, comments, postLikes, categories } from "@/lib/db/schema/schema";
import slugify from "slugify";
import { eq, and, or, ilike, inArray, SQL, desc, sql } from "drizzle-orm";
import { CreatePostInput, UpdatePostInput, POST_STATUS } from "@/lib/validations/blog";
import { ServiceError } from "@/lib/errors";

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
        // 1. Generate Slug
        const slug = await this.generateUniqueSlug(params.title);

        // 2. Insert Post
        const [newPost] = await db
            .insert(posts)
            .values({
                title: params.title,
                slug,
                content: params.content,
                excerpt: params.excerpt || null,
                // Assume coverImage is already an uploaded URL if present
                coverImage: params.coverImage || null,
                status: params.status as PostStatus,
                authorId: params.authorId,
            })
            .returning();

        // 3. Link Categories
        try {
            if (params.categoryIds && params.categoryIds.length > 0) {
                const categoryValues = params.categoryIds.map((categoryId) => ({
                    postId: newPost.id,
                    categoryId,
                }));
                await db.insert(postCategories).values(categoryValues);
            }
        } catch (error) {
            // Manual Rollback: Delete the created post if category linking fails
            await db.delete(posts).where(eq(posts.id, newPost.id));
            throw error;
        }

        return newPost;
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

        // SECURITY: If post is draft, ONLY allow author to view it
        if (post.status === "draft" && post.authorId !== userId) {
            return null;
        }

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
        // 1. Find existing post
        const existingPost = await db.query.posts.findFirst({
            where: eq(posts.slug, slug),
        });

        if (!existingPost) {
            throw ServiceError.notFound("Blog post not found");
        }

        // 2. Handle Slug change
        const newSlug = params.title && params.title !== existingPost.title
            ? await this.generateUniqueSlug(params.title)
            : existingPost.slug;

        // 3. Update Post
        const updateData: Record<string, unknown> = {
            updatedAt: new Date(),
        };
        if (params.title) {
            updateData.title = params.title;
            updateData.slug = newSlug;
        }
        if (params.content) updateData.content = params.content;
        if (params.excerpt !== undefined) updateData.excerpt = params.excerpt;
        if (params.coverImage) updateData.coverImage = params.coverImage;
        if (params.status) updateData.status = params.status;

        const [updatedPost] = await db
            .update(posts)
            .set(updateData)
            .where(eq(posts.slug, slug))
            .returning();

        // 4. Update Categories
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

        return updatedPost;
    }

    static async deletePost(slug: string) {
        const post = await db.query.posts.findFirst({
            where: eq(posts.slug, slug),
        });

        if (!post) {
            throw ServiceError.notFound("Blog post not found");
        }

        // Delete cascade manually
        await db.delete(postCategories).where(eq(postCategories.postId, post.id));
        await db.delete(comments).where(eq(comments.postId, post.id));
        await db.delete(postLikes).where(eq(postLikes.postId, post.id));
        await db.delete(posts).where(eq(posts.id, post.id));

        return true;
    }

    static async getAllPosts(filters: { status?: PostStatus; authorId?: string; categorySlug?: string; search?: string; viewerId?: string } = {}) {
        const whereConditions: SQL[] = [];

        // SECURITY: Draft Visibility Logic
        const { status: statusFilter, viewerId } = filters;

        // Base visibility rule: Guests see only published posts.
        // Logged-in users see all published posts plus their own drafts.
        if (!viewerId) {
            whereConditions.push(eq(posts.status, "published"));
        } else {
            whereConditions.push(or(
                eq(posts.status, "published"),
                and(eq(posts.status, "draft"), eq(posts.authorId, viewerId))
            )!);
        }

        // If a specific status is requested, it acts as an additional filter
        // on top of the base visibility rules.
        if (statusFilter) {
            // This will correctly return no results if a guest requests drafts,
            // or a user requests drafts of another user.
            whereConditions.push(eq(posts.status, statusFilter));
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

        return await db.query.posts.findMany({
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
            where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
        });
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
