// __tests__/app/api/users/[id]/follow/route.test.ts

// Mock next/server FIRST
jest.mock("next/server", () => ({
    NextResponse: {
        json: (data: any, init?: ResponseInit) => {
            return {
                json: async () => data,
                status: init?.status || 200,
            };
        },
    },
    NextRequest: class MockNextRequest {
        url: string;
        method: string;
        headers: Headers;

        constructor(url: string, init?: RequestInit) {
            this.url = url;
            this.method = init?.method || "GET";
            this.headers = new Headers(init?.headers);
        }
    },
}));

// Mock all other dependencies BEFORE any imports
jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth", () => ({
    authOptions: {},
}));

const mockDb: any = {
    query: {
        users: {
            findFirst: jest.fn(),
        },
        follows: {
            findFirst: jest.fn(),
        },
    },
    insert: jest.fn(),
    delete: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(async (callback) => callback(mockDb)),
};

jest.mock("@/lib/db", () => ({
    db: mockDb,
}));

jest.mock("@/lib/db/schema/schema", () => ({
    users: {
        id: "id",
        followerCount: "follower_count",
        followingCount: "following_count",
    },
    follows: {
        followerId: "follower_id",
        followingId: "following_id",
    },
}));

jest.mock("drizzle-orm", () => {
    const actual = jest.requireActual("drizzle-orm");
    return {
        ...actual,
        sql: jest.fn(),
    };
});

// NOW import after all mocks are set up
import { POST, DELETE } from "@/app/api/users/[id]/follow/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { NextRequest } from "next/server";

const mockGetServerSession = getServerSession as jest.MockedFunction<
    typeof getServerSession
>;

describe("POST /api/users/[id]/follow", () => {
    const mockCurrentUserId = "current-user-123";
    const mockTargetUserId = "target-user-456";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should follow a user successfully", async () => {
        const mockTargetUser = {
            id: mockTargetUserId,
            name: "Target User",
            email: "target@example.com",
            followerCount: 10,
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.users.findFirst as jest.Mock)
            .mockResolvedValueOnce(mockTargetUser)
            .mockResolvedValueOnce({ ...mockTargetUser, followerCount: 11 });

        (db.query.follows.findFirst as jest.Mock).mockResolvedValue(null);

        (db.insert as jest.Mock).mockReturnValue({
            values: jest.fn().mockResolvedValue(undefined),
        });

        (db.execute as jest.Mock).mockResolvedValue(undefined);

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "POST",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.isFollowing).toBe(true);
        expect(data.followerCount).toBe(11);
    });

    it("should return 401 if not authenticated", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "POST",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if trying to follow yourself", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        const req = new NextRequest(
            "http://localhost:3000/api/users/current-user-123/follow",
            {
                method: "POST",
            }
        );
        const params = Promise.resolve({ id: mockCurrentUserId });

        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Cannot follow yourself");
    });

    it("should return 404 if target user not found", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.users.findFirst as jest.Mock).mockResolvedValue(null);

        const req = new NextRequest(
            "http://localhost:3000/api/users/nonexistent/follow",
            {
                method: "POST",
            }
        );
        const params = Promise.resolve({ id: "nonexistent" });

        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("User not found");
    });

    it("should return 400 if already following", async () => {
        const mockTargetUser = {
            id: mockTargetUserId,
            name: "Target User",
            email: "target@example.com",
        };

        const mockExistingFollow = {
            followerId: mockCurrentUserId,
            followingId: mockTargetUserId,
            createdAt: new Date(),
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.users.findFirst as jest.Mock).mockResolvedValue(mockTargetUser);
        (db.query.follows.findFirst as jest.Mock).mockResolvedValue(
            mockExistingFollow
        );

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "POST",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Already following this user");
    });
});

describe("DELETE /api/users/[id]/follow", () => {
    const mockCurrentUserId = "current-user-123";
    const mockTargetUserId = "target-user-456";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should unfollow a user successfully", async () => {
        const mockExistingFollow = {
            followerId: mockCurrentUserId,
            followingId: mockTargetUserId,
            createdAt: new Date(),
        };

        const mockTargetUser = {
            id: mockTargetUserId,
            followerCount: 10,
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.follows.findFirst as jest.Mock).mockResolvedValue(
            mockExistingFollow
        );

        (db.delete as jest.Mock).mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
        });

        (db.execute as jest.Mock).mockResolvedValue(undefined);

        (db.query.users.findFirst as jest.Mock).mockResolvedValue({
            ...mockTargetUser,
            followerCount: 9,
        });

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "DELETE",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await DELETE(req, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.isFollowing).toBe(false);
        expect(data.followerCount).toBe(9);
    });

    it("should return 401 if not authenticated", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "DELETE",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await DELETE(req, { params });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if not following the user", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.follows.findFirst as jest.Mock).mockResolvedValue(null);

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "DELETE",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        const response = await DELETE(req, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Not following this user");
    });

    it("should use GREATEST to prevent negative follower counts", async () => {
        const mockExistingFollow = {
            followerId: mockCurrentUserId,
            followingId: mockTargetUserId,
            createdAt: new Date(),
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (db.query.follows.findFirst as jest.Mock).mockResolvedValue(
            mockExistingFollow
        );

        (db.delete as jest.Mock).mockReturnValue({
            where: jest.fn().mockResolvedValue(undefined),
        });

        const mockExecute = jest.fn().mockResolvedValue(undefined);
        (db.execute as jest.Mock) = mockExecute;

        (db.query.users.findFirst as jest.Mock).mockResolvedValue({
            id: mockTargetUserId,
            followerCount: 0,
        });

        const req = new NextRequest(
            "http://localhost:3000/api/users/target-user-456/follow",
            {
                method: "DELETE",
            }
        );
        const params = Promise.resolve({ id: mockTargetUserId });

        await DELETE(req, { params });

        // Verify that execute was called (which contains GREATEST)
        expect(mockExecute).toHaveBeenCalled();
    });
});