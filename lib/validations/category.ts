import { z } from "zod";

export const createCategorySchema = z.object({
    name: z
        .string()
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must be less than 50 characters")
        .trim(),
    description: z
        .string()
        .max(200, "Description must be less than 200 characters")
        .optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
