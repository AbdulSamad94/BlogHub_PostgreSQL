import { NextResponse } from "next/server";
import { CategoryService } from "@/lib/services/categoryService";

export async function GET() {
    try {
        const allCategories = await CategoryService.getAllCategories();

        return NextResponse.json({
            success: true,
            categories: allCategories,
        });
    } catch (error) {
        console.error("Fetch categories error:", error);
        return NextResponse.json(
            { error: "Failed to fetch categories" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const newCategory = await CategoryService.createCategory({
            name: body.name,
            description: body.description,
        });

        return NextResponse.json({
            success: true,
            category: newCategory,
        });
    } catch (error) {
        console.error("Create category error:", error);
        return NextResponse.json(
            { error: "Failed to create category" },
            { status: 500 }
        );
    }
}