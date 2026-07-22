import logging
import json
import time
import os
from app.utils.context import request_id_ctx, trace_id_ctx, user_id_ctx

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "context": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(),
            "trace_id": trace_id_ctx.get(),
            "user_id": user_id_ctx.get(),
            "service": "najmah-ai-service"
        }

        is_prod = os.getenv("NODE_ENV") == "production"

        if record.exc_info:
            log_entry["error_type"] = record.exc_info[0].__name__
            if not is_prod:
                log_entry["stack"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)

def setup_json_logging():
    # Setup root logger handlers
    root_logger = logging.getLogger()
    is_prod = os.getenv("NODE_ENV") == "production"

    if is_prod:
        # Clear existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        root_logger.addHandler(handler)
        root_logger.setLevel(logging.INFO)
    else:
        # Standard configuration for development
        logging.basicConfig(level=logging.INFO)
