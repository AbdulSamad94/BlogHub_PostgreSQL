import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema/schema";
import { eq } from "drizzle-orm";
import slugify from "slugify";
import { CreateCategoryInput } from "@/lib/validations/category";

export class CategoryService {
    /**
     * Fetches all categories ordered by name
     */
    static async getAllCategories() {
        return await db.query.categories.findMany({
            orderBy: (categories, { asc }) => [asc(categories.name)],
        });
    }

    /**
     * Creates a new category
     * Expects validated input
     */
    static async createCategory(data: CreateCategoryInput) {
        const slug = slugify(data.name, { lower: true, strict: true });

        // Check for duplicate slug
        const existing = await db.query.categories.findFirst({
            where: eq(categories.slug, slug),
        });

        if (existing) {
            throw new Error(`Category with slug '${slug}' already exists`);
        }

        const [newCategory] = await db
            .insert(categories)
            .values({
                name: data.name,
                slug,
                description: data.description ?? null,
            })
            .returning();

        return newCategory;
    }
}
