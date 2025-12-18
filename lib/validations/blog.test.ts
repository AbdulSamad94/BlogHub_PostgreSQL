import { createPostSchema } from './blog';

describe('Blog Validation Schema', () => {
  test('validates correct blog data', () => {
    const validBlog = {
      title: 'My Blog Post That Is Adequate Length',
      content: '<p>This is my blog post content that is adequately long enough to pass the validation criteria that checks for minimum length</p>',
      coverImage: 'https://example.com/image.jpg',
      categoryIds: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'], // UUIDs
      status: 'draft',
      authorId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'
    };

    const result = createPostSchema.safeParse(validBlog);
    expect(result.success).toBe(true);
  });

  test('fails validation for empty title', () => {
    const invalidBlog = {
      title: '',
      content: '<p>This is my blog post content</p>',
      status: 'draft',
      authorId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'
    };

    const result = createPostSchema.safeParse(invalidBlog);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toBeDefined();
    }
  });

  test('fails validation for content that is too short', () => {
    const invalidBlog = {
      title: 'My Blog Post',
      content: '<p>Hi</p>', // Too short
      status: 'draft',
      authorId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'
    };

    const result = createPostSchema.safeParse(invalidBlog);
    expect(result.success).toBe(false);
  });

  test('fails validation for invalid cover image URL', () => {
    const invalidBlog = {
      title: 'My Blog Post',
      content: '<p>This is my blog post content that is long enough</p>',
      coverImage: 'not-a-valid-url',
      status: 'draft',
      authorId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13'
    };

    const result = createPostSchema.safeParse(invalidBlog);
    expect(result.success).toBe(false);
  });

  test('fails validation for invalid UUIDs', () => {
    const invalidBlog = {
      title: 'My Blog Post',
      content: '<p>This is my blog post content</p>',
      categoryIds: ['invalid-uuid'],
      status: 'draft',
      authorId: 'invalid-uuid'
    };

    const result = createPostSchema.safeParse(invalidBlog);
    expect(result.success).toBe(false);
  });
});
