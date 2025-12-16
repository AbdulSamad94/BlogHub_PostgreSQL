import { db } from "@/lib/db";
import { users, posts, follows } from "@/lib/db/schema/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const DEFAULT_PROFILE_IMAGE = "/default-profile.jpeg";

export class UserService {
    /**
     * Handles OAuth user creation or retrieval
     */
    static async handleOauthUser(
        user: { email: string; name?: string; image?: string },
        account: { provider: string; providerAccountId: string }
    ) {
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
                console.log("OAuth user saved to DB:", user.email);
                return true;
            } else {
                console.log("OAuth user already exists:", user.email);
                return true;
            }
        } catch (error) {
            console.error("Error saving OAuth user to DB:", error);
            return false; // Indicating failure to sign in check
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
                : and(eq(posts.authorId, userId), eq(posts.status, "published")),
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
    static async updateUserProfile(userId: string, data: { name?: string; bio?: string }) {
        // Standardize input
        const updateData: { name?: string; bio?: string } = {};
        if (data.name !== undefined) updateData.name = data.name.trim();
        if (data.bio !== undefined) updateData.bio = data.bio.trim();

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
     */
    static async followUser(currentUserId: string, targetUserId: string) {
        if (currentUserId === targetUserId) {
            throw new Error("Cannot follow yourself");
        }

        const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
        });

        if (!targetUser) {
            throw new Error("User not found");
        }

        const existingFollow = await db.query.follows.findFirst({
            where: and(
                eq(follows.followerId, currentUserId),
                eq(follows.followingId, targetUserId)
            ),
        });

        if (existingFollow) {
            throw new Error("Already following this user");
        }

        await db.insert(follows).values({
            followerId: currentUserId,
            followingId: targetUserId,
            createdAt: new Date(),
        });

        await db.execute(
            sql`UPDATE ${users} SET follower_count = follower_count + 1 WHERE ${users.id} = ${targetUserId}`
        );

        await db.execute(
            sql`UPDATE ${users} SET following_count = following_count + 1 WHERE ${users.id} = ${currentUserId}`
        );

        return true;
    }

    /**
     * Unfollows a user
     */
    static async unfollowUser(currentUserId: string, targetUserId: string) {
        const existingFollow = await db.query.follows.findFirst({
            where: and(
                eq(follows.followerId, currentUserId),
                eq(follows.followingId, targetUserId)
            ),
        });

        if (!existingFollow) {
            throw new Error("Not following this user");
        }

        await db
            .delete(follows)
            .where(
                and(
                    eq(follows.followerId, currentUserId),
                    eq(follows.followingId, targetUserId)
                )
            );

        await db.execute(
            sql`UPDATE ${users} SET follower_count = GREATEST(follower_count - 1, 0) WHERE ${users.id} = ${targetUserId}`
        );

        await db.execute(
            sql`UPDATE ${users} SET following_count = GREATEST(following_count - 1, 0) WHERE ${users.id} = ${currentUserId}`
        );

        return true;
    }
}
