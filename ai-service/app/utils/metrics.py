import time

class Histogram:
    def __init__(self):
        self.buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        self.bucket_counts = {b: 0 for b in self.buckets}
        self.count = 0
        self.sum = 0.0

    def observe(self, value_seconds: float):
        self.count += 1
        self.sum += value_seconds
        for b in self.buckets:
            if value_seconds <= b:
                self.bucket_counts[b] += 1

    def get_prometheus_format(self, name: str, help_text: str) -> str:
        lines = [
            f"# HELP {name} {help_text}",
            f"# TYPE {name} histogram",
        ]
        for b in self.buckets:
            lines.append(f'{name}_bucket{{le="{b}"}} {self.bucket_counts[b]}')
        lines.append(f'{name}_bucket{{le="+Inf"}} {self.count}')
        lines.append(f"{name}_sum {round(self.sum, 4)}")
        lines.append(f"{name}_count {self.count}")
        return "\n".join(lines)

ai_requests = 0
ai_provider_failures = 0
ai_generation_success = 0
ai_request_duration = Histogram()

def increment_ai_requests():
    global ai_requests
    ai_requests += 1

def increment_provider_failures():
    global ai_provider_failures
    ai_provider_failures += 1

def increment_generation_success():
    global ai_generation_success
    ai_generation_success += 1

def observe_request_duration(seconds: float):
    ai_request_duration.observe(seconds)

def get_prometheus_metrics() -> str:
    return "\n".join([
        "# HELP ai_requests_total Total HTTP requests received by AI service",
        "# TYPE ai_requests_total counter",
        f"ai_requests_total {ai_requests}",
        "",
        "# HELP ai_provider_failures_total Total generation failures (Gemini)",
        "# TYPE ai_provider_failures_total counter",
        f"ai_provider_failures_total {ai_provider_failures}",
        "",
        "# HELP ai_generation_success_total Total AI generation successes (Gemini)",
        "# TYPE ai_generation_success_total counter",
        f"ai_generation_success_total {ai_generation_success}",
        "",
        ai_request_duration.get_prometheus_format(
            "ai_request_duration_seconds",
            "AI request duration in seconds"
        )
    ])
