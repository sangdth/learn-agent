import { HTTPException } from 'hono/http-exception'
import type { Hono } from 'hono'
import { ZodError } from 'zod'
import type { AppEnv } from './create-router.js'

export interface ApiError {
  code: string
  message: string
  requestId: string
}

export interface ApiErrorBody {
  error: ApiError
}

const HTTP_CODE_FOR_STATUS: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'unprocessable_entity',
  429: 'too_many_requests',
  500: 'internal',
  502: 'bad_gateway',
  503: 'service_unavailable',
  504: 'gateway_timeout',
}

const codeForStatus = (status: number): string =>
  HTTP_CODE_FOR_STATUS[status] ?? (status >= 500 ? 'internal' : 'error')

export interface ErrorResponse {
  status: number
  body: ApiErrorBody
}

const toZodMessage = (err: ZodError): string =>
  err.issues
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')

export const toErrorResponse = (err: unknown, requestId: string): ErrorResponse => {
  if (err instanceof HTTPException) {
    const status = err.status
    return {
      status,
      body: {
        error: {
          code: codeForStatus(status),
          message: err.message || 'Request failed',
          requestId,
        },
      },
    }
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'validation_error',
          message: toZodMessage(err),
          requestId,
        },
      },
    }
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'internal_error',
        message: 'Internal Server Error',
        requestId,
      },
    },
  }
}

export const registerErrorHandler = (app: Hono<AppEnv>): void => {
  app.onError((err, c) => {
    const requestId = c.get('requestId') ?? ''
    const { status, body } = toErrorResponse(err, requestId)
    return c.json(body, status as Parameters<typeof c.json>[1])
  })

  app.notFound((c) => {
    const requestId = c.get('requestId') ?? ''
    const body: ApiErrorBody = {
      error: {
        code: 'not_found',
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        requestId,
      },
    }
    return c.json(body, 404)
  })
}
