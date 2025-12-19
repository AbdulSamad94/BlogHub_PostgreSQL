import { z } from "zod";

export const POST_STATUS = ["draft", "published"] as const;

export const createPostSchema = z.object({
    title: z
        .string()
        .min(5, "Title must be at least 5 characters")
        .max(100, "Title must be less than 100 characters")
        .trim(),
    content: z.string().min(20, "Content must be at least 20 characters"),
    excerpt: z
        .string()
        .max(300, "Excerpt must be less than 300 characters")
        .optional(),
    coverImage: z.string().url("Invalid image URL").optional(),
    coverImageBase64: z.string().optional(),
    coverImageType: z.string().optional(),
    status: z.enum(POST_STATUS).default("draft"),
    authorId: z.string().uuid("Invalid author ID"), // Assuming UUIDs
    categoryIds: z.array(z.string().uuid("Invalid category ID")).optional(),
});

export const updatePostSchema = createPostSchema.partial().extend({
    // Explicitly allow partial updates but validation rules remain for present fields
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;