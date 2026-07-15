import swaggerUi from "swagger-ui-express";
import type { Application } from "express";

/**
 * OpenAPI 3.0 specification skeleton.
 * Endpoints will be added per-module as features are built in later parts.
 */
const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Buddy Script API",
    version: "1.0.0",
    description:
      "REST API for the Buddy Script social feed application. " +
      "Authentication, posts, comments, replies, and likes endpoints " +
      "will be documented here as they are implemented.",
    contact: {
      name: "Buddy Script",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Health", description: "Server health check" },
    { name: "Auth", description: "Registration and login (Part 3)" },
    { name: "Posts", description: "Posts and timeline (Part 4–5)" },
    { name: "Comments", description: "Comments and replies (Part 6–7)" },
    { name: "Likes", description: "Like / unlike interactions (Part 8–9)" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns 200 OK when the server is running.",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["firstName", "lastName", "email", "password"],
                properties: {
                  firstName: { type: "string", example: "Ada" },
                  lastName: { type: "string", example: "Lovelace" },
                  email: { type: "string", format: "email", example: "ada@example.com" },
                  password: { type: "string", minLength: 8, example: "supersecret123" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "User registered — returns user + JWT token" },
          "400": { description: "Validation error" },
          "409": { description: "Email already in use" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "ada@example.com" },
                  password: { type: "string", example: "supersecret123" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated — returns user + JWT token" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/posts": {
      post: {
        tags: ["Posts"],
        summary: "Create a new post",
        description:
          "Creates a post with optional image upload. " +
          "Accepts multipart/form-data with a `content` text field and an optional `image` file. " +
          "At least one of content or image must be provided. Requires a valid JWT.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Post text (optional if image is provided)",
                    example: "Just shipped a new feature!",
                  },
                  image: {
                    type: "string",
                    format: "binary",
                    description: "Image file (optional, max 5 MB, images only)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Post created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        userId: { type: "string", format: "uuid" },
                        content: { type: "string", nullable: true },
                        imageUrl: { type: "string", nullable: true },
                        visibility: { type: "string", enum: ["public", "private"] },
                        createdAt: { type: "string", format: "date-time" },
                        likeCount: { type: "integer", example: 0 },
                        commentCount: { type: "integer", example: 0 },
                        user: {
                          type: "object",
                          nullable: true,
                          properties: {
                            id: { type: "string", format: "uuid" },
                            firstName: { type: "string" },
                            lastName: { type: "string" },
                            email: { type: "string", format: "email" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "No content or image provided" },
          "401": { description: "Missing or invalid JWT" },
          "413": { description: "Image exceeds 5 MB limit" },
        },
      },
      get: {
        tags: ["Posts"],
        summary: "Get public feed posts",
        description:
          "Returns a paginated list of public posts ordered by createdAt DESC. " +
          "Each post includes author info, like count, and comment count. " +
          "Requires a valid JWT in the Authorization header.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10, maximum: 50 },
            description: "Number of posts to return per page (max 50)",
          },
          {
            name: "cursor",
            in: "query",
            schema: { type: "string", format: "date-time" },
            description:
              "Keyset pagination cursor — ISO 8601 createdAt of the last item on the previous page",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of public posts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          userId: { type: "string", format: "uuid" },
                          content: { type: "string", nullable: true },
                          imageUrl: { type: "string", nullable: true },
                          visibility: { type: "string", enum: ["public", "private"] },
                          createdAt: { type: "string", format: "date-time" },
                          likeCount: { type: "integer" },
                          commentCount: { type: "integer" },
                          user: {
                            type: "object",
                            nullable: true,
                            properties: {
                              id: { type: "string", format: "uuid" },
                              firstName: { type: "string" },
                              lastName: { type: "string" },
                              email: { type: "string", format: "email" },
                            },
                          },
                        },
                      },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        hasNextPage: { type: "boolean" },
                        nextCursor: { type: "string", nullable: true, format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid JWT" },
        },
      },
    },
  },
    "/api/posts/comments/{commentId}/replies": {
      get: {
        tags: ["Comments"],
        summary: "Get direct replies to a comment",
        description:
          "Returns paginated direct replies (parentId = commentId) ordered newest-first. " +
          "Requires a valid JWT.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "commentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "UUID of the parent comment",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10, maximum: 50 },
          },
        ],
        responses: {
          "200": { description: "Paginated list of replies" },
          "401": { description: "Missing or invalid JWT" },
        },
      },
    },
    "/api/posts/{postId}/comments": {
      get: {
        tags: ["Comments"],
        summary: "Get top-level comments for a post",
        description:
          "Returns paginated level-1 comments (parentId IS NULL) ordered newest-first. " +
          "Nested replies are fetched separately in Part 7. Requires a valid JWT.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "postId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "UUID of the post",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
            description: "Page number (1-based)",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10, maximum: 50 },
            description: "Comments per page",
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of top-level comments",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          postId: { type: "string", format: "uuid" },
                          userId: { type: "string", format: "uuid" },
                          parentId: { type: "string", nullable: true, example: null },
                          content: { type: "string" },
                          createdAt: { type: "string", format: "date-time" },
                          user: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              firstName: { type: "string" },
                              lastName: { type: "string" },
                              email: { type: "string", format: "email" },
                            },
                          },
                        },
                      },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid JWT" },
        },
      },
      post: {
        tags: ["Comments"],
        summary: "Add a top-level comment to a post",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "postId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", example: "Great post!" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Comment created — returns comment with user info" },
          "400": { description: "Content is required" },
          "401": { description: "Missing or invalid JWT" },
        },
      },
    },
    "/api/likes/{entityType}/{entityId}/users": {
      get: {
        tags: ["Likes"],
        summary: "Get users who liked an entity",
        description:
          "Returns a paginated list of users who have liked the specified post or comment, " +
          "ordered by most-recent like first. Only public profile fields are returned — " +
          "no sensitive data such as passwordHash. Requires a valid JWT.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "entityType",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["post", "comment"] },
            description: "Whether the target is a post or a comment",
          },
          {
            name: "entityId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "UUID of the post or comment",
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated list of users who liked the entity",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          likeId: { type: "string", format: "uuid" },
                          createdAt: { type: "string", format: "date-time" },
                          user: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              firstName: { type: "string" },
                              lastName: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                    meta: {
                      type: "object",
                      properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid entityType" },
          "401": { description: "Missing or invalid JWT" },
        },
      },
    },
    "/api/likes/toggle": {
      post: {
        tags: ["Likes"],
        summary: "Toggle like / unlike on a post or comment",
        description:
          "If the authenticated user has not yet liked the entity, a like row is inserted " +
          "and `action: 'liked'` is returned. If they already liked it, the row is deleted " +
          "and `action: 'unliked'` is returned. Requires a valid JWT.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["entityType", "entityId"],
                properties: {
                  entityType: {
                    type: "string",
                    enum: ["post", "comment"],
                    description: "Whether the target is a post or a comment",
                    example: "post",
                  },
                  entityId: {
                    type: "string",
                    format: "uuid",
                    description: "UUID of the post or comment to like/unlike",
                    example: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Like toggled successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        action: {
                          type: "string",
                          enum: ["liked", "unliked"],
                          example: "liked",
                        },
                        entityType: { type: "string", enum: ["post", "comment"] },
                        entityId: { type: "string", format: "uuid" },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid entityType / entityId" },
          "401": { description: "Missing or invalid JWT" },
        },
      },
    },
  components: {

    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT token obtained from POST /api/auth/login",
      },
    },
  },
};

export function setupSwagger(app: Application): void {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customSiteTitle: "Buddy Script API Docs",
    }),
  );
  console.log("📖  Swagger UI available at http://localhost:3001/api-docs");
}

export { swaggerDocument };
