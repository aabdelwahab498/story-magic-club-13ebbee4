import uuid
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.utils.context import request_id_ctx, trace_id_ctx, user_id_ctx
from app.utils.metrics import increment_ai_requests, observe_request_duration

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        is_sys_endpoint = "/health" in path or "/metrics" in path

        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
        user_id = request.headers.get("x-user-id") or None

        token_req = request_id_ctx.set(request_id)
        token_trc = trace_id_ctx.set(trace_id)
        token_usr = user_id_ctx.set(user_id)

        if not is_sys_endpoint:
            increment_ai_requests()

        start_time = time.time()
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Trace-ID"] = trace_id
            return response
        finally:
            duration_seconds = time.time() - start_time
            if not is_sys_endpoint:
                observe_request_duration(duration_seconds)

            request_id_ctx.reset(token_req)
            trace_id_ctx.reset(token_trc)
            user_id_ctx.reset(token_usr)
