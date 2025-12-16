import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authOptions";
import { UserService } from "@/lib/services/userService";

// GET /api/users/[id] - Fetch user profile with posts
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }

) {
    try {
        const userId = (await params).id;
        const session = await getAuthSession();
        const currentUserId = session?.user?.id;

        const userProfile = await UserService.getUserProfile(userId, currentUserId);

        if (!userProfile) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            user: userProfile,
        });
    } catch (error) {
        console.error("Fetch user profile error:", error);
        return NextResponse.json(
            { error: "Failed to fetch user profile" },
            { status: 500 }
        );
    }
}

// PUT /api/users/[id] - Update user profile
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getAuthSession();
        const userId = (await params).id;

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Only allow updating own profile
        if (session.user.id !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();

        // Basic validation before calling service
        if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length === 0)) {
            return NextResponse.json(
                { error: "Name must be a non-empty string" },
                { status: 400 }
            );
        }

        if (body.bio !== undefined && typeof body.bio !== "string") {
            return NextResponse.json({ error: "Bio must be a string" }, { status: 400 });
        }

        await UserService.updateUserProfile(userId, {
            name: body.name,
            bio: body.bio,
        });

        // We need to re-fetch the full profile or construct it. 
        // The service update returns the user object, but the frontend expects posts included in the response typically?
        // Checking existing implementation: old one returned user + posts.
        // Let's reuse getUserProfile to ensure consistency or modify updateProfile to return everything.
        // For efficiency, the frontend likely just needs the updated user info, but let's stick to the previous contract:
        // "return user object with posts"

        const fullUserProfile = await UserService.getUserProfile(userId, session.user.id);

        return NextResponse.json({
            success: true,
            user: fullUserProfile
        });
    } catch (error) {
        console.error("Update user profile error:", error);
        return NextResponse.json(
            { error: "Failed to update user profile" },
            { status: 500 }
        );
    }
}
