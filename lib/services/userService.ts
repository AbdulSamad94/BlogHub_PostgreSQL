import { db } from "@/lib/db";
import { users, posts, follows } from "@/lib/db/schema/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { UserUpdateInput } from "@/lib/validations/user";

const DEFAULT_PROFILE_IMAGE = "/default-profile.jpeg";
const POST_STATUS_PUBLISHED = "published";

export interface OauthUser {
    email: string;
    name?: string;
    image?: string;
}

export interface OauthAccount {
    provider: string;
    providerAccountId: string;
}

export class UserService {
    /**
     * Handles OAuth user creation or retrieval
     * Throws error on failure instead of returning boolean
     */
    static async handleOauthUser(user: OauthUser, account: OauthAccount): Promise<boolean> {
        try {
            const existingUser = await db.query.users.findFirst({
                where: eq(users.email, user.email),
            });

            if (!existingUser) {
                await db.insert(users).values({
                    name: user.name ?? "Unnamed User",
                    email: user.email,
                    passwordHash: null,
                    image: user.image ?? DEFAULT_PROFILE_IMAGE,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId ?? null,
                });
                // Consider logging only in debug mode or specific logger
                // console.log("OAuth user saved to DB:", user.email); 
            }

            return true;
        } catch (error) {
            console.error("UserService.handleOauthUser error:", error);
            throw new Error("Failed to handle OAuth user");
        }
    }

    /**
     * Fetches user profile data, including posts and follow status
     */
    static async getUserProfile(userId: string, currentUserId?: string) {
        // 1. Fetch Basic User Info
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
                id: true,
                name: true,
                email: true,
                image: true,
                bio: true,
                followerCount: true,
                followingCount: true,
                createdAt: true,
            },
        });

        if (!user) return null;

        // 2. Check Follow Status
        let isFollowing = false;
        if (currentUserId && currentUserId !== userId) {
            const followRecord = await db.query.follows.findFirst({
                where: and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, userId)
                ),
            });
            isFollowing = !!followRecord;
        }

        // 3. Determine View Mode
        const isOwnProfile = currentUserId === userId;

        // 4. Fetch Posts
        const userPosts = await db.query.posts.findMany({
            where: isOwnProfile
                ? eq(posts.authorId, userId)
                : and(eq(posts.authorId, userId), eq(posts.status, POST_STATUS_PUBLISHED)),
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

        return {
            ...user,
            isFollowing,
            isOwnProfile,
            posts: userPosts,
        };
    }

    /**
     * Updates user profile
     */
    static async updateUserProfile(userId: string, data: UserUpdateInput) {
        // Input validation should be done by the caller (API layer) using Zod.
        // Double check emptiness to be safe or rely on Zod.
        const updateData: { name?: string; bio?: string } = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.bio !== undefined) updateData.bio = data.bio;

        if (Object.keys(updateData).length === 0) {
            throw new Error("No update data provided");
        }

        const [updatedUser] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
                bio: users.bio,
                followerCount: users.followerCount,
                followingCount: users.followingCount,
                createdAt: users.createdAt,
            });

        return updatedUser;
    }

    /**
     * Follows a user
     * Uses transaction to ensure consistency
     */
    static async followUser(currentUserId: string, targetUserId: string) {
        if (currentUserId === targetUserId) {
            throw new Error("Cannot follow yourself");
        }

        // Wrap in transaction for atomicity
        // Note: Drizzle + Neon HTTP supports transactions (serialized or batched).
        return await db.transaction(async (tx) => {
            const targetUser = await tx.query.users.findFirst({
                where: eq(users.id, targetUserId),
            });

            if (!targetUser) {
                throw new Error("User not found");
            }

            const existingFollow = await tx.query.follows.findFirst({
                where: and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, targetUserId)
                ),
            });

            if (existingFollow) {
                throw new Error("Already following this user");
            }

            await tx.insert(follows).values({
                followerId: currentUserId,
                followingId: targetUserId,
                createdAt: new Date(),
            });

            await tx.execute(
                sql`UPDATE ${users} SET follower_count = follower_count + 1 WHERE ${users.id} = ${targetUserId}`
            );

            await tx.execute(
                sql`UPDATE ${users} SET following_count = following_count + 1 WHERE ${users.id} = ${currentUserId}`
            );

            return true;
        });
    }

    /**
     * Unfollows a user
     * Uses transaction to ensure consistency
     */
    static async unfollowUser(currentUserId: string, targetUserId: string) {
        return await db.transaction(async (tx) => {
            const existingFollow = await tx.query.follows.findFirst({
                where: and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, targetUserId)
                ),
            });

            if (!existingFollow) {
                throw new Error("Not following this user");
            }

            await tx
                .delete(follows)
                .where(
                    and(
                        eq(follows.followerId, currentUserId),
                        eq(follows.followingId, targetUserId)
                    )
                );

            await tx.execute(
                sql`UPDATE ${users} SET follower_count = GREATEST(follower_count - 1, 0) WHERE ${users.id} = ${targetUserId}`
            );

            await tx.execute(
                sql`UPDATE ${users} SET following_count = GREATEST(following_count - 1, 0) WHERE ${users.id} = ${currentUserId}`
            );

            return true;
        });
    }
}
