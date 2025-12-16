import { GET, DELETE, PUT } from "./route";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { BlogService } from "@/lib/services/blogService";

// Mock next-auth
jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

// Mock BlogService
jest.mock("@/lib/services/blogService", () => ({
  BlogService: {
    getPostBySlug: jest.fn(),
    deletePost: jest.fn(),
    updatePost: jest.fn(),
  },
}));

jest.mock("@/lib/db", () => ({
  db: {
    query: { posts: { findFirst: jest.fn() } }, // Minimal mock to satisfy usage if any
  },
}));

describe("Blog Detail API Routes", () => {
  const mockGetServerSession = getServerSession as jest.Mock;
  const mockGetPostBySlug = BlogService.getPostBySlug as jest.Mock;
  const mockDeletePost = BlogService.deletePost as jest.Mock;
  const mockUpdatePost = BlogService.updatePost as jest.Mock;

  const mockPost = {
    id: "post1",
    slug: "test-blog",
    title: "Test Blog",
    content: "<p>Test content</p>",
    excerpt: "Test excerpt",
    coverImage: "/test.jpg",
    status: "published",
    authorId: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: "user1",
      name: "Test Author",
      email: "test@example.com",
      image: "/avatar.jpg",
    },
    postCategories: [],
    comments: [],
    likes: [],
  };

  const mockSession = {
    user: {
      id: "user1",
      name: "Test User",
      email: "test@example.com",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockGetPostBySlug.mockResolvedValue(mockPost);
  });

  describe("GET /api/blogs/[id]", () => {
    test("successfully fetches blog by slug", async () => {
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.post.title).toBe("Test Blog");
      expect(mockGetPostBySlug).toHaveBeenCalledWith("test-blog");
    });

    test("returns 404 for non-existent blog", async () => {
      mockGetPostBySlug.mockResolvedValue(null);

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "non-existent" }) }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Blog post not found");
    });

    test("returns 400 when ID is missing", async () => {
      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "" }) }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("ID is required");
    });

    test("returns draft post for author only", async () => {
      mockGetPostBySlug.mockResolvedValue({
        ...mockPost,
        status: "draft",
      });

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.post.status).toBe("draft");
    });

    test("returns 404 for draft post when not author", async () => {
      mockGetPostBySlug.mockResolvedValue({
        ...mockPost,
        status: "draft",
        authorId: "different-user",
      });

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(404);
    });

    test("handles server error", async () => {
      mockGetPostBySlug.mockRejectedValue(new Error("Service error"));

      // Suppress console.error
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

      const response = await GET(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to fetch blog post");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("DELETE /api/blogs/[id]", () => {
    test("successfully deletes blog as author", async () => {
      mockDeletePost.mockResolvedValue(true);

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Blog post deleted successfully");
      expect(mockDeletePost).toHaveBeenCalledWith("test-blog");
    });

    test("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 403 when trying to delete another user's blog", async () => {
      mockGetPostBySlug.mockResolvedValue({
        ...mockPost,
        authorId: "different-user",
      });

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden: You can only delete your own blog posts");
    });

    test("returns 404 when blog not found", async () => {
      mockGetPostBySlug.mockResolvedValue(null);

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: "non-existent" }) }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Blog post not found");
    });

    test("handles deletion error", async () => {
      mockDeletePost.mockRejectedValue(new Error("Service error"));

      // Suppress console.error
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

      const response = await DELETE(
        {} as NextRequest,
        { params: Promise.resolve({ id: "test-blog" }) }
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Failed to delete blog post");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("PUT /api/blogs/[id]", () => {
    const validUpdateData = {
      title: "Updated Title",
      content: "<p>Updated content</p>",
      excerpt: "Updated excerpt",
      status: "published",
      categoryIds: ["cat1"],
    };

    beforeEach(() => {
      mockUpdatePost.mockResolvedValue({
        ...mockPost,
        title: "Updated Title",
      });
    });

    test("successfully updates blog as author", async () => {
      const request = {
        json: jest.fn().mockResolvedValue(validUpdateData),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Blog post updated successfully");
      expect(mockUpdatePost).toHaveBeenCalledWith("test-blog", expect.objectContaining({
        title: "Updated Title",
        authorId: "user1"
      }));
    });

    test("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const request = {
        json: jest.fn().mockResolvedValue(validUpdateData),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(401);
    });

    test("returns 400 when title is missing", async () => {
      const request = {
        json: jest.fn().mockResolvedValue({ ...validUpdateData, title: "" }),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Title is required");
    });

    test("returns 400 when title is too short", async () => {
      const request = {
        json: jest.fn().mockResolvedValue({ ...validUpdateData, title: "Hi" }),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Title must be at least 5 characters");
    });

    test("returns 403 when trying to update another user's blog", async () => {
      mockGetPostBySlug.mockResolvedValue({
        ...mockPost,
        authorId: "different-user",
      });

      const request = {
        json: jest.fn().mockResolvedValue(validUpdateData),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden: You can only edit your own blog posts");
    });

    test("holds error message from service", async () => {
      mockUpdatePost.mockRejectedValue(new Error("Service error message here"));

      const request = {
        json: jest.fn().mockResolvedValue(validUpdateData),
      } as unknown as NextRequest;

      const response = await PUT(request, {
        params: Promise.resolve({ id: "test-blog" }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Service error message here");
    });
  });
});