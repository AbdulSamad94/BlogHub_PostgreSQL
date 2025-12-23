import { BlogService } from "./blogService";
import { db } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
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
    });

    describe("updatePost", () => {
        it("should throw ServiceError.notFound when post does not exist", async () => {
            // Mock transaction to execute callback
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                // Mock findFirst inside transaction to return null
                const mockTx = {
                    query: {
                        posts: {
                            findFirst: jest.fn().mockResolvedValue(null),
                        },
                    },
                };
                return callback(mockTx);
            });

            try {
                await BlogService.updatePost("non-existent-slug", { title: "Updated" });
                fail("Should have thrown ServiceError");
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe("NOT_FOUND");
            }
        });
    });

    describe("deletePost", () => {
        it("should throw ServiceError.notFound when post does not exist", async () => {
            // Mock transaction to execute callback
            (db.transaction as jest.Mock).mockImplementation(async (callback) => {
                const mockTx = {
                    query: {
                        posts: {
                            findFirst: jest.fn().mockResolvedValue(null),
                        },
                    },
                };
                return callback(mockTx);
            });

            try {
                await BlogService.deletePost("non-existent-slug");
                fail("Should have thrown ServiceError");
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                expect((error as ServiceError).code).toBe("NOT_FOUND");
            }
        });
    });

    describe("getAllPosts", () => {
        it("should fetch all posts with correct default ordering and exclude content", async () => {
            const mockFindMany = jest.fn().mockResolvedValue([{ id: "post-1" }]);
            (db.query.posts.findMany as jest.Mock).mockImplementation(mockFindMany);

            const result = await BlogService.getAllPosts();

            expect(result).toEqual([{ id: "post-1" }]);
            expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({
                columns: expect.objectContaining({ content: false }),
                orderBy: expect.any(Array),
            }));
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
