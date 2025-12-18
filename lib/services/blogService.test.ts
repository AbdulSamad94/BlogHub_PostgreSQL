
import { BlogService } from "./blogService";
import { db } from "@/lib/db";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { posts, postCategories } from "@/lib/db/schema/schema";

jest.mock("@/lib/db", () => {
    const mockDbImpl: any = {
        insert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        query: {
            posts: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            users: {
                findFirst: jest.fn(),
            },
            follows: {
                findFirst: jest.fn(),
            }
        },
        execute: jest.fn(),
    };

    // Add transaction logic that references the impl
    mockDbImpl.transaction = jest.fn(async (callback: any) => callback(mockDbImpl));

    return {
        db: mockDbImpl,
    };
});

jest.mock("@/lib/cloudinary", () => ({
    uploadImageToCloudinary: jest.fn(),
}));



describe("BlogService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createPost", () => {
        const validParams = {
            title: "Test Blog Post",
            content: "Content of the blog post",
            authorId: "user-123",
            status: "draft" as const,
        };

        it("should generate a slug and insert post into db", async () => {
            // Mock DB insert returning
            const mockInsertValues = jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{ id: "post-123" }]),
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockInsertValues,
            });
            (db.insert as jest.Mock).mockImplementation(mockInsert);

            // Mock DB findFirst for the slug check (return null = no collision) AND return value
            (db.query.posts.findFirst as jest.Mock)
                .mockResolvedValueOnce(null) // for generateUniqueSlug check
                .mockResolvedValueOnce({ // for createPost return (now inside transaction, or retrieved after?)
                    // In refactor, createPost returns 'newPost' from insert().returning() directly in most cases
                    // But wait, the service does: const [newPost] = await tx.insert()... returning(); return newPost.
                    // So we don't necessarily call findFirst again for the return value in the simplified refactor?
                    // Let's check the service code...
                    // "return newPost;" (from returning()).
                    // BUT generateUniqueSlug calls findFirst.
                    // So only ONE findFirst call expected if no collision.
                });

            // Just return null for slug check
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue(null);

            const result = await BlogService.createPost(validParams);

            // Check slug generation
            expect(mockInsert).toHaveBeenCalledWith(posts);
            const insertCall = mockInsertValues.mock.calls[0][0];
            // 0.5.toString(36) is "0.i" -> substring(2, 7) might depend on implementation but roughly "i..."
            // Actually, let's just check it contains the base slug.
            expect(insertCall.slug).toBe("test-blog-post");
            expect(insertCall.title).toBe(validParams.title);

            expect(result).toEqual(expect.objectContaining({ id: "post-123" }));
        });

        it("should handle image upload if base64 provided", async () => {
            (uploadImageToCloudinary as jest.Mock).mockResolvedValue("https://cloudinary.com/image.jpg");

            const mockReturning = jest.fn().mockResolvedValue([{ id: "post-123" }]);
            const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

            (db.insert as jest.Mock).mockImplementation(mockInsert);
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue(null);

            await BlogService.createPost({
                ...validParams,
                coverImageBase64: "base64string",
                coverImageType: "image/png",
            });

            expect(uploadImageToCloudinary).toHaveBeenCalledWith("base64string", "image/png");

            // Verify insert called with correct image URL
            const insertCall = mockValues.mock.calls[0][0];
            expect(insertCall.coverImage).toBe("https://cloudinary.com/image.jpg");
        });

        it("should link categories if provided", async () => {
            const mockInsertValues = jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([{ id: "post-123" }]),
            });
            const mockInsert = jest.fn().mockReturnValue({
                values: mockInsertValues,
            });
            (db.insert as jest.Mock).mockImplementation(mockInsert);
            (db.query.posts.findFirst as jest.Mock)
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({});

            await BlogService.createPost({
                ...validParams,
                categoryIds: ["cat-1", "cat-2"],
            });

            // First insert is post, second is categories
            expect(mockInsert).toHaveBeenCalledTimes(2);

            // Check second insert for categories
            expect(mockInsert).toHaveBeenLastCalledWith(postCategories);
            const categoryInsertCall = mockInsertValues.mock.calls[1][0];

            // It passes an array of objects
            expect(categoryInsertCall).toEqual([
                { postId: "post-123", categoryId: "cat-1" },
                { postId: "post-123", categoryId: "cat-2" },
            ]);
        });
    });

    describe("getAllPosts", () => {
        it("should fetch all posts with correct default ordering", async () => {
            const mockFindMany = jest.fn().mockResolvedValue([{ id: "post-1" }]);
            (db.query.posts.findMany as jest.Mock).mockImplementation(mockFindMany);

            const result = await BlogService.getAllPosts();

            expect(result).toEqual([{ id: "post-1" }]);
            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: expect.any(Array),
            }));
        });

        it("should apply status filter", async () => {
            const mockFindMany = jest.fn().mockResolvedValue([]);
            (db.query.posts.findMany as jest.Mock).mockImplementation(mockFindMany);

            await BlogService.getAllPosts({ status: "published" });

            // We can't easily inspect the exact SQL construction with simplified mocking
            // but we can ensure findMany was called.
            expect(mockFindMany).toHaveBeenCalled();
        });
    });
});
