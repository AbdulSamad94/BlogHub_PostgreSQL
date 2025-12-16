import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { UserService } from "@/lib/services/userService";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/schema";
import { eq } from "drizzle-orm";

// POST /api/users/[id]/follow - Follow a user
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getAuthSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: targetUserId } = await params;
        const currentUserId = session.user.id;

        try {
            await UserService.followUser(currentUserId, targetUserId);
        } catch (error: unknown) {
            if ((error as Error).message === "Cannot follow yourself" || (error as Error).message === "Already following this user") {
                return NextResponse.json({ error: (error as Error).message }, { status: 400 });
            }
            if ((error as Error).message === "User not found") {
                return NextResponse.json({ error: "User not found" }, { status: 404 });
            }
            throw error;
        }

        // Get updated follower count
        const updatedTargetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
            columns: { followerCount: true },
        });

        return NextResponse.json({
            success: true,
            isFollowing: true,
            followerCount: updatedTargetUser?.followerCount || 0,
        });
    } catch (error) {
        console.error("Follow user error:", error);
        return NextResponse.json(
            { error: "Failed to follow user" },
            { status: 500 }
        );
    }
}

// DELETE /api/users/[id]/follow - Unfollow a user
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getAuthSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: targetUserId } = await params;
        const currentUserId = session.user.id;

        try {
            await UserService.unfollowUser(currentUserId, targetUserId);
        } catch (error: unknown) {
            if (error instanceof Error && error.message === "Not following this user") {
                return NextResponse.json({ error: "Not following this user" }, { status: 400 });
            }
            throw error;
        }

        // Get updated follower count
        const updatedTargetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
            columns: { followerCount: true },
        });

        return NextResponse.json({
            success: true,
            isFollowing: false,
            followerCount: updatedTargetUser?.followerCount || 0,
        });
    } catch (error) {
        console.error("Unfollow user error:", error);
        return NextResponse.json(
            { error: "Failed to unfollow user" },
            { status: 500 }
        );
    }
}