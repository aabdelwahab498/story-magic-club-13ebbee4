# ClamAV Self-Host Recipe (for `upload-finalize`)

The `upload-finalize` edge function expects an external HTTPS endpoint that
scans bytes with ClamAV and returns a simple verdict. If `CLAMAV_SCAN_URL` is
**not** configured, the pipeline runs in **fail-open** mode and stamps every
log with `scan_engine="none"` — fine for development, **not** for production.

## Contract expected by `_shared/clamavScan.ts`

```
POST  $CLAMAV_SCAN_URL
Headers:
  X-Scan-Secret: $CLAMAV_SCAN_SECRET   (shared secret, verified by the server)
Body: multipart/form-data
  field "FILES" -> the binary file blob

Response (HTTP 200):
  JSON  { "Status": "OK"   }                              -> clean
  JSON  { "Status": "FOUND", "Description": "Eicar-Test"} -> infected
  OR plain text containing "Everything ok"  / "stream: OK"          -> clean
  OR plain text containing ": <signature> FOUND"                    -> infected
```

The client retries up to 2 times with exponential back-off on network/5xx errors,
times out after 25 s, and falls back to `engine="failover"` if all retries fail.
A failover verdict **does not move the file** — it returns 500 to the caller.

## Recommended images

| Image                          | Notes                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `ajilach/clamav-rest`          | REST wrapper around `clamd`, exposes `/scan`. Returns the JSON contract above. |
| `lokesh1729/clamav-rest`       | Smaller, multi-arch.                                                    |
| `clamav/clamav` + custom proxy | Use `clamd` socket directly + a tiny Express/Go proxy that enforces `X-Scan-Secret`. |

## Fly.io quickstart

```bash
fly launch --image ajilach/clamav-rest --no-deploy
fly secrets set SCAN_SECRET=$(openssl rand -hex 32)
fly volumes create clamav_data --size 5
# In fly.toml: mount the volume to /var/lib/clamav and expose port 8080 over HTTPS.
fly deploy
```

Then in Lovable Cloud (Settings → Functions → Secrets):

```
CLAMAV_SCAN_URL    = https://<your-app>.fly.dev/scan
CLAMAV_SCAN_SECRET = <same value as SCAN_SECRET>
```

## Render / Railway / VPS

- Pull `ajilach/clamav-rest:latest`, expose port 8080 behind HTTPS.
- Set env `SCAN_SECRET=<random>` and require it in a tiny reverse-proxy header
  check, OR use the image's built-in token middleware if available.
- ClamAV downloads ~250 MB of signature data on first start — give the
  container at least 1 GB RAM and 3 GB disk.

## Verifying the integration

```bash
# Should return Status: OK
curl -F "FILES=@README.md" -H "X-Scan-Secret: $CLAMAV_SCAN_SECRET" $CLAMAV_SCAN_URL

# EICAR test string (safe malware test vector)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > /tmp/eicar.txt
curl -F "FILES=@/tmp/eicar.txt" -H "X-Scan-Secret: $CLAMAV_SCAN_SECRET" $CLAMAV_SCAN_URL
# -> Status: FOUND, Description: Win.Test.EICAR_HDB-1
```

## What the pipeline does on each verdict

| Verdict       | Action                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| `clean`       | Move file from `temp-uploads` to target bucket; log `moved`; return signed URL.         |
| `infected`    | Delete temp file; log `scanned_infected`; **block user from `upload-finalize` for 24h**; return 422 to client. |
| `error`       | Keep temp file (auto-cleaned in 1h); log `error`; return 500.                           |
| `skipped`     | (Only when secrets missing) Treat as clean but log `scan_engine="none"`.                |

## Recommended cadence

- Update signature DB (`freshclam`) hourly — the official image does this on a schedule.
- Re-deploy the proxy after a base-image bump.
- Monitor `upload_security_logs` where `action='scanned_infected'` to track abuse.
