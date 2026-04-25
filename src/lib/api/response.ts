import { ZodError } from "zod";

type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "UNPROCESSABLE_ENTITY"
  | "INTERNAL_ERROR";

type ErrorBody = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    issues?: unknown;
  };
};

function error(
  status: number,
  code: ErrorCode,
  message: string,
  issues?: unknown
): Response {
  const body: ErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(issues ? { issues } : {}),
    },
  };

  return Response.json(body, { status });
}

export function badRequest(message: string, issues?: unknown): Response {
  return error(400, "BAD_REQUEST", message, issues);
}

export function notFound(message: string): Response {
  return error(404, "NOT_FOUND", message);
}

export function unprocessable(message: string): Response {
  return error(422, "UNPROCESSABLE_ENTITY", message);
}

export function internalError(message = "Unexpected server error"): Response {
  return error(500, "INTERNAL_ERROR", message);
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function fromError(err: unknown): Response {
  if (err instanceof ZodError) {
    return badRequest("Invalid request parameters", err.issues);
  }

  if (err instanceof Error) {
    if (err.message.startsWith("Route not found")) {
      return notFound(err.message);
    }

    if (err.message.startsWith("Sequence out of range")) {
      return unprocessable(err.message);
    }

    if (err.message.startsWith("Route ") && err.message.includes("does not include operator")) {
      return unprocessable(err.message);
    }
  }

  return internalError();
}
