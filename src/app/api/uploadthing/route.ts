import { createRouteHandler } from "uploadthing/next";
import { NextResponse } from "next/server";
import {
  isUploadThingConfigured,
  ourFileRouter,
} from "@/app/api/uploadthing/core";

const handlers = createRouteHandler({
  router: ourFileRouter,
});

async function withGracefulFallback(
  method: "GET" | "POST",
  req: Request,
) {
  if (!isUploadThingConfigured()) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            "UploadThing is not configured. Set UPLOADTHING_TOKEN to enable uploads.",
          code: "UPLOADTHING_NOT_CONFIGURED",
        },
      },
      { status: 503 },
    );
  }

  try {
    if (method === "GET") return handlers.GET(req as never);
    return handlers.POST(req as never);
  } catch (error) {
    console.error("[uploadthing]", error);
    return NextResponse.json(
      {
        data: null,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "UploadThing request failed",
          code: "UPLOADTHING_ERROR",
        },
      },
      { status: 500 },
    );
  }
}

export const GET = (req: Request) => withGracefulFallback("GET", req);
export const POST = (req: Request) => withGracefulFallback("POST", req);
