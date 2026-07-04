import type { z } from "zod";

/** Canonical API error envelope. */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const body: ApiErrorBody = {
    error: { code, message, ...(details ? { details } : {}) },
  };
  return Response.json(body, { status });
}

/** 400 with field-level details built from a Zod error. */
export function validationErrorResponse(error: z.ZodError): Response {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    (details[key] ??= []).push(issue.message);
  }
  return errorResponse(
    400,
    "validation_error",
    "The recipe document failed validation.",
    details,
  );
}

export const unauthorized = () =>
  errorResponse(401, "unauthorized", "A valid API key is required.");

export const notFound = (message = "Recipe not found.") =>
  errorResponse(404, "not_found", message);
