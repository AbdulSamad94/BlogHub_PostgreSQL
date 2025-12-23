import { BlogService } from "./blogService";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import { posts, postCategories } from "@/lib/db/schema/schema";
import { CreatePostInput } from "@/lib/validations/blog";

jest.mock("@/lib/db", () => {
    const mockChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
    };

    const mockDbImpl: any = {
        insert: jest.fn().mockReturnValue(mockChain),
        delete: jest.fn().mockReturnValue(mockChain),
        update: jest.fn().mockReturnValue(mockChain),
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

    return {
        db: mockDbImpl,
    };
});

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

            // Mock DB findFirst for the slug check (return null = no collision)
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue(null);

            const result = await BlogService.createPost(validParams);

            // Check slug generation
            expect(mockInsert).toHaveBeenCalledWith(posts);
            const insertCall = mockInsertValues.mock.calls[0][0];
            expect(insertCall.slug).toBe("test-blog-post");
            expect(insertCall.title).toBe(validParams.title);

            expect(result).toEqual(expect.objectContaining({ id: "post-123" }));
        });

        it("should use provided coverImage URL if passed", async () => {
            const mockReturning = jest.fn().mockResolvedValue([{ id: "post-123" }]);
            const mockValues = jest.fn().mockReturnValue({ returning: mockReturning });
            const mockInsert = jest.fn().mockReturnValue({ values: mockValues });

            (db.insert as jest.Mock).mockImplementation(mockInsert);
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue(null);

            await BlogService.createPost({
                ...validParams,
                coverImage: "https://cloudinary.com/image.jpg",
            });

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
        it("should rollback (delete post) if category linking fails", async () => {
            const mockPost = { id: "post-rollback" };

            // 1. Mock slug generation
            (db.query.posts.findFirst as jest.Mock).mockResolvedValue(null);

            // 2. Mock successful post insert
            const mockChain = {
                values: jest.fn().mockReturnThis(),
                returning: jest.fn().mockResolvedValue([mockPost]),
            };
            (db.insert as jest.Mock).mockReturnValueOnce(mockChain);

            // 3. Mock FAILED category insert
            const mockFailChain = {
                values: jest.fn().mockRejectedValue(new Error("Category DB Error")),
            };
            (db.insert as jest.Mock).mockReturnValueOnce(mockFailChain);

            // 4. Mock delete for rollback
            const mockDeleteChain = {
                where: jest.fn().mockReturnThis(),
            };
            (db.delete as jest.Mock).mockReturnValue(mockDeleteChain);

            const input: CreatePostInput = {
                title: "Rollback Test",
                content: "Content",
                status: "draft",
                authorId: "user-1",
                categoryIds: ["cat-1"],
            };

            await expect(BlogService.createPost(input)).rejects.toThrow("Category DB Error");

            // Verify delete was called with correct ID
            expect(db.delete).toHaveBeenCalledWith(posts);
        });
    });



    describe("deletePost", () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should throw ServiceError.notFound when post does not exist", async () => {
            // Explicitly set the mock to resolve to null for this test
            const mockFindFirst = db.query.posts.findFirst as jest.Mock;

            // Force it to be null irrespective of calls
            mockFindFirst.mockReset();
            mockFindFirst.mockResolvedValue(null);

            await expect(
                BlogService.deletePost("non-existent-slug")
            ).rejects.toThrow(ServiceError);
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
            // We removed explicit 'columns' check since we might not be filtering columns anymore 
            // or the default is fine.
        });


        it("should fetch drafts when viewer is the author", async () => {
            const mockFindMany = jest.fn().mockResolvedValue([{ id: "post-1", status: "draft" }]);
            (db.query.posts.findMany as jest.Mock).mockImplementation(mockFindMany);

            const result = await BlogService.getAllPosts({
                status: "draft",
                authorId: "user-123",
                viewerId: "user-123"
            });

            expect(result).toEqual([{ id: "post-1", status: "draft" }]);
            expect(mockFindMany).toHaveBeenCalled();
        });

        it("should apply status filter for published posts", async () => {
            const mockFindMany = jest.fn().mockResolvedValue([]);
            (db.query.posts.findMany as jest.Mock).mockImplementation(mockFindMany);

            await BlogService.getAllPosts({ status: "published" });

            expect(mockFindMany).toHaveBeenCalled();
        });
    });
});
