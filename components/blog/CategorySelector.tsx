"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { categoryApi } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  name: string;
}

interface CategorySelectorProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  onCategoriesLoaded?: (categories: Category[]) => void;
}

export function CategorySelector({
  selectedCategories,
  onChange,
  onCategoriesLoaded,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await categoryApi.getAllCategories();
        setCategories(response.categories);
        onCategoriesLoaded?.(response.categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to load categories");
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, [onCategoriesLoaded]);

  const handleAddCategory = (categoryId: string) => {
    if (!selectedCategories.includes(categoryId)) {
      onChange([...selectedCategories, categoryId]);
    }
  };

  const handleRemoveCategory = (categoryId: string) => {
    onChange(selectedCategories.filter((id) => id !== categoryId));
  };

  return (
    <div>
      <label className="text-sm font-semibold mb-2 block">
        Categories (Optional)
      </label>
      {loading ? (
        <div className="text-sm text-muted-foreground">
          Loading categories...
        </div>
      ) : (
        <>
          <Select onValueChange={handleAddCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select categories" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.id}
                  disabled={selectedCategories.includes(category.id)}
                >
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedCategories.map((categoryId) => {
                const category = categories.find((c) => c.id === categoryId);
                return (
                  <Badge key={categoryId} variant="secondary" className="gap-1">
                    {category?.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(categoryId)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
