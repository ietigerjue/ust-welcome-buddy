import { createFileRoute } from "@tanstack/react-router";
import {
  buildParsedImageKnowledgeFromText,
  parseImageWithOcrAndTextModel,
} from "@/lib/imageOcr";
import {
  getImageParseProvider,
  understandImageWithMiniMaxVlm,
} from "@/lib/imageUnderstanding";
import {
  reviewSemanticDuplicates,
  type SemanticDuplicateReviewResult,
} from "@/lib/semanticDuplicateReview";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const IMAGE_UNDERSTANDING_PROMPT = [
  "你是一个图像文字理解助手。请读取这张图片中的所有可见文字，并整理成适合知识库导入的 Markdown 正文。",
  "",
  "要求：",
  "1. 尽量完整提取图片中的文字。",
  "2. 保留标题、段落、列表结构。",
  "3. 如果图片是长图、海报、流程图或清单，请整理成清晰 Markdown。",
  "4. 不要编造图片中没有的信息。",
  "5. 如果某些文字无法识别，请标注为“无法识别”。",
  "6. 输出正文即可，不要输出 JSON。",
].join("\n");

type ParseImageResponse =
  | {
      title: string;
      category: string;
      source: "Image Upload";
      source_url: string;
      source_type: "image_upload";
      updatedAt: string;
      keywords: string[];
      summary: string;
      content: string;
      duplicate_review: SemanticDuplicateReviewResult;
    }
  | {
      error: string;
    };

type ParseImagePayload = {
  source_url?: unknown;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function json(data: ParseImageResponse, init?: ResponseInit) {
  return Response.json(data, init);
}

function getEnv(name: string) {
  const value = (globalThis as typeof globalThis & { process?: ProcessLike })
    .process?.env?.[name];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isAuthorized(request: Request) {
  const expectedToken = getEnv("ADMIN_IMPORT_TOKEN");
  const providedToken = request.headers.get("x-admin-token")?.trim();

  return Boolean(expectedToken && providedToken && providedToken === expectedToken);
}

export const Route = createFileRoute("/api/admin/parse-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ error: "Unauthorized." }, { status: 401 });
        }

        const formData = await request.formData().catch(() => null);
        const image = formData?.get("image");

        if (!(image instanceof File)) {
          return json(
            { error: "Missing required multipart file field: image." },
            { status: 400 }
          );
        }

        if (!ALLOWED_IMAGE_TYPES.includes(image.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
          return json(
            { error: "Unsupported image type. Only PNG, JPEG, and WebP are allowed." },
            { status: 400 }
          );
        }

        if (image.size > MAX_IMAGE_SIZE_BYTES) {
          return json(
            { error: "Image is too large. Please upload an image under 20MB." },
            { status: 400 }
          );
        }

        try {
          const sourceUrlValue = formData?.get("source_url");
          const payload: ParseImagePayload = {
            source_url:
              typeof sourceUrlValue === "string" ? sourceUrlValue.trim() : "",
          };
          const sourceUrl =
            typeof payload.source_url === "string" ? payload.source_url : "";
          const provider = await getImageParseProvider();
          let parsedImage;

          if (provider === "ocr") {
            parsedImage = await parseImageWithOcrAndTextModel({
              file: image,
              sourceUrl,
            });
          } else {
            try {
              const imageBuffer = Buffer.from(await image.arrayBuffer());
              const understoodContent = await understandImageWithMiniMaxVlm(
                imageBuffer,
                image.type,
                IMAGE_UNDERSTANDING_PROMPT
              );

              parsedImage = await buildParsedImageKnowledgeFromText({
                content: understoodContent,
                sourceUrl,
              });
            } catch (vlmError) {
              const vlmMessage =
                vlmError instanceof Error ? vlmError.message : "unknown error";

              console.warn(
                "[admin/parse-image] MiniMax VLM failed, falling back to OCR:",
                vlmMessage
              );

              try {
                parsedImage = await parseImageWithOcrAndTextModel({
                  file: image,
                  sourceUrl,
                });
              } catch (ocrError) {
                const ocrMessage =
                  ocrError instanceof Error ? ocrError.message : "unknown error";

                throw new Error(
                  `MiniMax VLM failed: ${vlmMessage}. OCR fallback also failed: ${ocrMessage}`
                );
              }
            }
          }

          const duplicateReview = await reviewSemanticDuplicates({
            content: parsedImage.content,
          });

          return json({
            ...parsedImage,
            duplicate_review: duplicateReview,
          });
        } catch (error) {
          console.error(
            "[admin/parse-image] Image parsing failed:",
            error instanceof Error ? error.message : error
          );

          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Image parsing failed. Please paste the text manually.",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
