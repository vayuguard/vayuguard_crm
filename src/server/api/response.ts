import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export type ApiMeta = {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
};

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit) {
  return NextResponse.json({ data, meta, error: null }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export function fail(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      data: null,
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
    { status: 500 },
  );
}
