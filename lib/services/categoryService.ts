import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema/schema";
import slugify from "slugify";

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
     */
    static async createCategory(data: { name: string; description?: string }) {
        const slug = slugify(data.name, { lower: true, strict: true });

        const [newCategory] = await db
            .insert(categories)
            .values({
                name: data.name,
                slug,
                description: data.description || null,
            })
            .returning();

        return newCategory;
    }
}
