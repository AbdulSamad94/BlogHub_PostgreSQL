// __tests__/app/api/users/[id]/route.test.ts

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
        _body: string | null;

        constructor(url: string, init?: RequestInit) {
            this.url = url;
            this.method = init?.method || "GET";
            this.headers = new Headers(init?.headers);
            this._body = init?.body as string || null;
        }

        async json() {
            return this._body ? JSON.parse(this._body) : {};
        }
    },
}));

// Mock UserService
jest.mock("@/lib/services/userService", () => ({
    UserService: {
        getUserProfile: jest.fn(),
        updateUserProfile: jest.fn(),
    },
}));

// Mock next-auth
jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth", () => ({
    authOptions: {},
}));

// Mock db (still needed for imports theoretically, but unused logic)
jest.mock("@/lib/db", () => ({
    db: {},
}));

jest.mock("@/lib/db/schema/schema", () => ({
    users: {},
    posts: {},
    follows: {},
}));

import { GET, PUT } from "@/app/api/users/[id]/route";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { UserService } from "@/lib/services/userService";

const mockGetServerSession = getServerSession as jest.MockedFunction<
    typeof getServerSession
>;

describe("GET /api/users/[id]", () => {
    const mockUserId = "user-123";
    const mockCurrentUserId = "current-user-123";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return user profile with posts for authenticated user", async () => {
        const mockUserProfile = {
            id: mockUserId,
            name: "John Doe",
            email: "john@example.com",
            image: "https://example.com/avatar.jpg",
            bio: "Software developer",
            followerCount: 10,
            followingCount: 5,
            createdAt: new Date("2024-01-01"),
            isFollowing: false,
            isOwnProfile: false,
            posts: [
                {
                    id: "post-1",
                    title: "Test Post",
                    status: "published",
                    createdAt: new Date("2024-01-15"),
                },
            ],
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (UserService.getUserProfile as jest.Mock).mockResolvedValue(mockUserProfile);

        const req = new NextRequest("http://localhost:3000/api/users/user-123");
        const params = Promise.resolve({ id: mockUserId });

        const response = await GET(req, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.id).toBe(mockUserId);
        expect(data.user.posts).toHaveLength(1);
    });

    it("should return 404 if user not found", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockCurrentUserId },
        } as any);

        (UserService.getUserProfile as jest.Mock).mockResolvedValue(null);

        const req = new NextRequest("http://localhost:3000/api/users/nonexistent");
        const params = Promise.resolve({ id: "nonexistent" });

        const response = await GET(req, { params });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("User not found");
    });
});

describe("PUT /api/users/[id]", () => {
    const mockUserId = "user-123";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should update user profile successfully", async () => {
        const updateData = {
            name: "Jane Doe",
            bio: "Updated bio",
        };

        const mockUpdatedProfile = {
            id: mockUserId,
            name: "Jane Doe",
            bio: "Updated bio",
            // ... other fields irrelevant for this test assertion
        };

        mockGetServerSession.mockResolvedValue({
            user: { id: mockUserId },
        } as any);

        // Update returns generic success/object
        (UserService.updateUserProfile as jest.Mock).mockResolvedValue(mockUpdatedProfile);
        // Get profile returns full object
        (UserService.getUserProfile as jest.Mock).mockResolvedValue(mockUpdatedProfile);

        const req = new NextRequest("http://localhost:3000/api/users/user-123", {
            method: "PUT",
            body: JSON.stringify(updateData),
        });
        const params = Promise.resolve({ id: mockUserId });

        const response = await PUT(req, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.name).toBe("Jane Doe");
        expect(data.user.bio).toBe("Updated bio");
    });

    it("should return 401 if not authenticated", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const req = new NextRequest("http://localhost:3000/api/users/user-123", {
            method: "PUT",
            body: JSON.stringify({ name: "Test" }),
        });
        const params = Promise.resolve({ id: mockUserId });

        const response = await PUT(req, { params });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 403 if trying to update another user's profile", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: "different-user" },
        } as any);

        const req = new NextRequest("http://localhost:3000/api/users/user-123", {
            method: "PUT",
            body: JSON.stringify({ name: "Test" }),
        });
        const params = Promise.resolve({ id: mockUserId });

        const response = await PUT(req, { params });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe("Forbidden");
    });

    it("should validate name input", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockUserId },
        } as any);

        const req = new NextRequest("http://localhost:3000/api/users/user-123", {
            method: "PUT",
            body: JSON.stringify({ name: "" }),
        });
        const params = Promise.resolve({ id: mockUserId });

        const response = await PUT(req, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Name must be a non-empty string");
    });

    it("should validate bio input", async () => {
        mockGetServerSession.mockResolvedValue({
            user: { id: mockUserId },
        } as any);

        const req = new NextRequest("http://localhost:3000/api/users/user-123", {
            method: "PUT",
            body: JSON.stringify({ bio: 123 }),
        });
        const params = Promise.resolve({ id: mockUserId });

        const response = await PUT(req, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Bio must be a string");
    });
});
