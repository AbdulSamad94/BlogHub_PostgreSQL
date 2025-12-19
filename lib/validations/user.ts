import { z } from "zod";

export const userNameSchema = z
    .string()
    .min(1, "Name must be at least 1 character")
    .max(50, "Name must be less than 50 characters")
    .trim();

export const userBioSchema = z
    .string()
    .max(160, "Bio must be less than 160 characters")
    .trim()
    .optional();

export const userUpdateSchema = z.object({
    name: userNameSchema.optional(),
    bio: userBioSchema,
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
