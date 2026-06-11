# Phase C — Server-side face recognition + liveness (eKYC)

## Why we need this

Phase A (device-bound opaque tokens) and Phase B (hardware-backed
challenge-response) close the "any face logs in as any user" hole at
the protocol level. But they share a fundamental limitation:

> The OS biometric prompt verifies **"a trusted user of this device"**, not
> **"the BudgetBee account owner"**.

Concrete failure cases neither phase can fix:

| Scenario | Phase A/B behaviour | What banks do |
|---|---|---|
| Shared phone — wife has her face enrolled on husband's phone | She passes Face ID → opens his account | Server compares face embedding → rejects |
| Emulator with `BIOMETRIC_SUCCESS` always returned | App-side check passes → opens random account | Server-side liveness fails (no real camera) |
| Identical twin | OS may pass them as the same person | Embedding distance is small but liveness + ID card check catches it |
| Photo / video / 3D-printed mask attack | Some devices pass without liveness | Anti-spoofing model rejects |

Phase C makes the **account owner's actual face** the verification target,
not just "someone the device trusts". This is the same pattern Techcombank
/ MB Bank / Vietcombank / VietQR Pay use under the hood.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        Mobile (Expo)                          │
│                                                               │
│  ┌──────────┐   live frames    ┌──────────────────────┐       │
│  │  Camera  │──────────────────▶  Quick liveness gate │       │
│  └──────────┘                  │  (blink, head turn)  │       │
│                                └──────────┬───────────┘       │
│                                            │                  │
│                                JPEG frame  ▼                  │
│                                ┌──────────────────────┐       │
│                                │  Upload over HTTPS   │       │
│                                └──────────┬───────────┘       │
└────────────────────────────────────────────┼──────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────┐
│                  Laravel API (existing)                       │
│  POST /api/biometric/face/enroll   (auth)                     │
│  POST /api/biometric/face/login    (public)                   │
│  Both forward to:                                             │
└────────────────────────────────────────────┬──────────────────┘
                                              │ internal HTTPS
                                              ▼
┌───────────────────────────────────────────────────────────────┐
│        Face Service (FastAPI, Python 3.11)                    │
│                                                               │
│  1. Silent Face Anti-Spoofing  ──┐                            │
│  2. RetinaFace face detection    ├─ if any fail → 422         │
│  3. Pose / blur / quality gate ──┘                            │
│  4. InsightFace ArcFace (512-d embedding)                     │
│  5. pgvector cosine similarity vs `face_embeddings`           │
│       enroll: INSERT embedding                                │
│       login : top-1 nearest neighbour, gate by threshold      │
└────────────────────────────────────────────┬──────────────────┘
                                              │
                                              ▼
┌───────────────────────────────────────────────────────────────┐
│        PostgreSQL + pgvector                                  │
│  face_embeddings(user_id, embedding VECTOR(512), template_v,  │
│                  enrolled_at, last_matched_at, match_count)   │
│  ANN index: IVFFLAT with cosine distance, lists=100           │
└───────────────────────────────────────────────────────────────┘
```

### Why Python + FastAPI + InsightFace

- InsightFace (`buffalo_l` model) is the strongest publicly available
  face recognition model, well above FaceNet for under-30M-param size.
  It runs in ONNX Runtime so we don't need a CUDA build at deployment.
- FastAPI is the lightest async wrapper; one worker per CPU core saturates
  inference. Typical latency on a CPU-only VPS (4 vCPU) is ~150ms per
  embedding + ~5ms for a 100k-row IVFFLAT lookup. Acceptable for login UX.
- Laravel stays as the System-of-Record. The Face Service is a sidecar
  the mobile app never talks to directly — Laravel proxies, so auth,
  rate-limiting, and audit go through the existing security middleware.

---

## Threat model

### Defended

| Threat | Mitigation |
|---|---|
| Photo-of-photo attack | Silent Face Anti-Spoofing (CDCN-based) before embedding |
| Video replay | Active liveness challenge (random blink / head-turn / smile prompt) — embedded frame must have matching pose |
| Deepfake video | Anti-spoofing model rejects non-real depth signal; future: passive 3D depth (LiDAR / ToF on iPhone) |
| Identical twin | Embedding distance is too close; require step-up MFA when cosine sim is in 0.62-0.70 grey zone |
| Different person on same enrolled device | Embedding mismatch → reject regardless of device trust |
| Server compromise | Embeddings are non-invertible 512-d vectors; you cannot rebuild the face image from them. (Models like InsightFace are designed to be one-way.) |
| Cross-app embedding correlation | Pepper the embedding with a per-user salt before hashing for the comparison index |

### NOT defended (still password / MFA territory)

| Threat | Why we can't defend with face |
|---|---|
| Twin AND identical lighting AND identical pose | Embedding distance is within threshold; this is < 1 in 10^6 worldwide and Vietnamese banking guidance treats biometric as 1FA only |
| Forced biometric (someone holds phone to your face) | The OS does not distinguish "willing" from "coerced". Mitigation: PIN + dwell time on high-value actions |
| Account takeover via email reset | The face never touches email — that flow stays password-based with full OTP |

---

## Database schema

```sql
-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE face_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 512-d ArcFace embedding, L2-normalised at insert time so cosine
    -- distance == 1 - (a · b). pgvector's `<=>` returns cosine distance.
    embedding       VECTOR(512) NOT NULL,
    template_version TEXT NOT NULL DEFAULT 'arcface_buffalo_l_v1',
    -- Label so the user can have multiple enrolments: "no glasses", "with glasses"
    label           TEXT,
    -- Snapshot of the device that enrolled this row, for revocation
    device_fingerprint TEXT,
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_matched_at TIMESTAMPTZ,
    match_count     INT NOT NULL DEFAULT 0,
    revoked_at      TIMESTAMPTZ
);

-- IVFFLAT ANN index for 100k+ users. Build with lists ≈ sqrt(rows);
-- adjust periodically. Pre-build: SET maintenance_work_mem = '2GB'.
CREATE INDEX face_embeddings_cosine_idx
  ON face_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX face_embeddings_user_idx ON face_embeddings (user_id)
  WHERE revoked_at IS NULL;

-- Liveness audit: every attempt, including failures, gets a row
CREATE TABLE face_attempts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    matched_face_id BIGINT REFERENCES face_embeddings(id) ON DELETE SET NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('enroll', 'login')),
    ip_address      INET,
    device_fingerprint TEXT,
    liveness_score  REAL,           -- 0..1 from anti-spoofing model
    cosine_distance REAL,           -- 0 = identical, 2 = opposite
    result          TEXT NOT NULL CHECK (result IN ('ok','fail_liveness','fail_quality','fail_match','fail_threshold')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX face_attempts_user_idx ON face_attempts (user_id, created_at DESC);
```

### Migration from Phase A

`biometric_credentials` (Phase A) and `face_embeddings` (Phase C) co-exist
during rollout. A user is in one of three states:

- `phase_a_only` — has a `biometric_credentials` row, no `face_embeddings`
- `phase_c_only` — vice versa
- `both` — during the migration window

Login picks the strongest available method in this order: Phase C > Phase
B > Phase A > password. After 90 days with Phase C deployed, retire
`biometric_credentials` rows whose `last_used_at < now() - 90d`.

---

## API surface

### Enrolment (auth required)

```http
POST /api/biometric/face/enroll
Authorization: Bearer <sanctum_token>
Content-Type: multipart/form-data

frame:           binary JPEG (≤ 200 kB, 480-720px)
liveness_token:  string  (issued by /api/biometric/face/liveness-challenge)
label:           string  ("no_glasses", optional)
```

Server flow:

1. Validate liveness_token (cache lookup, single-use).
2. Forward to Face Service `/embed` with frame + token.
3. Face Service runs: anti-spoofing → detection → quality gate → embedding.
4. INSERT into `face_embeddings` with `user_id = $auth->id`.
5. Log to `face_attempts(kind='enroll', result='ok')`.

Failure cases return Vietnamese error messages mapped from Face Service codes.

### Login (public)

```http
POST /api/biometric/face/login
Content-Type: multipart/form-data

frame:           binary JPEG
liveness_token:  string
device_fingerprint: hex
```

Server flow:

1. Validate liveness_token.
2. Face Service `/match` → returns `(best_user_id, cosine_distance, liveness_score)`.
3. If `cosine_distance > 0.40` → 401 (no match).
4. If `cosine_distance > 0.30` AND `< 0.40` → 200 with `requires_step_up: true`
   (server-side grey zone — ask user to re-scan or fall back to PIN).
5. Else → 200 with Sanctum token (like the existing biometric endpoints).
6. Log to `face_attempts`.

Cosine thresholds are tuned with the open ArcFace + IJB-C eval set:
0.30 distance ≈ FAR 1e-6, 0.40 ≈ FAR 1e-4. Vietnamese banks operate
around 1e-5 (≈ 0.35).

### Liveness challenge

```http
GET /api/biometric/face/liveness-challenge

200 OK
{
  "liveness_token": "abc123...",  // single-use, 30s TTL
  "challenge_type": "blink" | "turn_left" | "turn_right" | "smile",
  "expires_in": 30
}
```

The mobile UI shows a prompt matching `challenge_type`. The Face Service's
anti-spoofing model checks both the spoof score AND that the frame's pose
matches the challenge type (e.g. for `turn_left`, the detected yaw is
between -45° and -15°). This makes a single recorded video useless — the
attacker would need a video matching the random challenge for each login.

---

## Face Service (sidecar)

```python
# face_service/app/main.py
from fastapi import FastAPI, UploadFile, HTTPException
from insightface.app import FaceAnalysis
from anti_spoof import SilentFaceAntiSpoof   # vendored from minivision-ai
import numpy as np, asyncpg, os

app = FastAPI()

# CPU build; if GPU, set providers=['CUDAExecutionProvider'].
face = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
face.prepare(ctx_id=0, det_size=(640, 640))
spoof = SilentFaceAntiSpoof()

@app.post('/embed')
async def embed(frame: UploadFile, liveness_token: str):
    raw = await frame.read()
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)

    score = spoof.predict(img)
    if score < 0.8:                 # < 0.8 = likely spoof
        raise HTTPException(422, {'code': 'fail_liveness', 'score': score})

    faces = face.get(img)
    if len(faces) != 1:
        raise HTTPException(422, {'code': 'fail_quality', 'msg': 'expect 1 face'})

    f = faces[0]
    if f.det_score < 0.6 or _blur_score(img) < 30:
        raise HTTPException(422, {'code': 'fail_quality'})

    emb = f.normed_embedding         # already L2-normalised, length 512
    return {'embedding': emb.tolist(), 'pose': f.pose.tolist()}

@app.post('/match')
async def match(frame: UploadFile, liveness_token: str):
    embedding_resp = await embed(frame, liveness_token)
    emb = embedding_resp['embedding']

    async with app.state.pg.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT user_id, id AS face_id, embedding <=> $1 AS dist '
            'FROM face_embeddings WHERE revoked_at IS NULL '
            'ORDER BY embedding <=> $1 LIMIT 1',
            emb,
        )
    return {
        'user_id': row['user_id'],
        'face_id': row['face_id'],
        'cosine_distance': float(row['dist']),
    }
```

### Deployment

- One Docker container, alongside the existing Laravel + Nginx + Postgres
  stack in `docker/`. Add a `face-service` service to `docker-compose.yml`
  with the `insightface` weights pre-baked into the image
  (~120 MB for `buffalo_l`).
- Laravel talks to it on `http://face-service:8000` over the docker
  network — never exposed publicly.
- Health check: `GET /healthz` returns InsightFace warm-up status.

---

## Performance budget

| Step | Latency on 4 vCPU CPU | On T4 GPU |
|---|---|---|
| JPEG decode + resize | 5 ms | 5 ms |
| Anti-spoofing | 30 ms | 4 ms |
| RetinaFace detect | 60 ms | 6 ms |
| ArcFace embed | 80 ms | 5 ms |
| pgvector top-1 (100k rows, lists=100) | 5 ms | 5 ms |
| **Total** | **~180 ms** | **~25 ms** |

User-perceived login time including HTTPS + scan animation: ~700-900ms.
Comparable to Techcombank's TC Pay flow (measured ~750ms p50).

---

## Compliance

Vietnam: Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân classifies
biometric data as "dữ liệu cá nhân nhạy cảm" (Article 2.4). Specific
requirements:

- Explicit, separate consent at enrolment (not bundled in ToS).
  → Show a dedicated screen with checkbox + Vietnamese text BEFORE first
    enrolment.
- Data minimisation: store only the embedding, not the raw image, after
  enrolment. The Face Service receives the JPEG but does not persist it.
- Right to deletion: `DELETE /api/biometric/face/{id}` permanently
  removes the row. Soft-delete is NOT compliant — actual `DELETE`.
- Audit trail: 2-year retention of `face_attempts`. We store the score,
  the result, and an IP hash — never the raw face.
- Cross-border transfer: face data may not leave Vietnam without
  notification. If Face Service is hosted off-shore, the user must opt-in.

GDPR (if international users): Article 9 covers biometric data;
same outcome — explicit consent + right to erasure.

---

## Rollout plan

1. **Week 1-2**: Stand up Face Service in docker-compose, expose only on
   internal network. Add `face_embeddings` migration. Build a CLI tool
   to generate test embeddings from staged faces.
2. **Week 3**: Add Laravel proxy endpoints + liveness challenge. Ship
   behind feature flag `BIOMETRIC_FACE_V2_ENABLED`. Internal alpha.
3. **Week 4-5**: Mobile UI — adapt existing `face-scan.tsx` /
   `face-login.tsx` to capture + upload frame. Keep the current OS-biometric
   flow as fallback when feature flag off.
4. **Week 6**: Public beta with opt-in toggle in Settings. Collect
   FAR/FRR metrics from `face_attempts`.
5. **Week 7-8**: Tune cosine threshold per the observed distribution.
   Default users to Phase C if score is healthy.
6. **Week 12+**: Retire Phase A `biometric_credentials` rows older than
   90 days.

---

## What we are NOT doing

- We are NOT implementing our own face model. InsightFace is published
  under the MIT-equivalent license; we use it as-is. Training a custom
  model would take 4-6 GPU-weeks and worse accuracy.
- We are NOT doing on-device matching. The 100 MB model + the privacy
  requirement (no embeddings shared between devices) means the server
  is the only place where match makes sense.
- We are NOT replacing fingerprint with face. Fingerprint stays Phase B
  (hardware-backed key) — the OS gate is sufficient for the fingerprint
  case because the OS already binds to a single finger pattern in TEE,
  unlike face which the OS treats as "any registered face".
- We are NOT storing face images at rest. Only embeddings.

---

## Cost (rough order of magnitude)

| Item | Monthly |
|---|---|
| 1× Hetzner CCX23 (4 vCPU, 16 GB RAM, AMD EPYC) | ~25 EUR |
| Object storage for incident-only image retention | ~3 EUR |
| TLS cert (Let's Encrypt) | 0 |
| **Total Phase C infra delta** | **< 30 EUR / month** |

A T4 GPU server is ~150 EUR/month and unnecessary for < 50k DAU.

---

## Open questions

- Active vs passive liveness: active (blink/turn) is harder to spoof but
  adds ~3s to login. Banks split this — Phase 1 active, then passive
  after the user has 10+ successful logins. We can do the same.
- Should we ship the InsightFace ONNX weights in the Docker image (120MB
  → 350MB image) or download on first boot (faster image, slower cold
  start)? Decision: bake in, cold start matters more.
- Two-factor for high-value transactions: face + TOTP, or face + PIN?
  Current direction: face for login, PIN for transactions ≥ 5M VND, TOTP
  for changing PIN itself. Mirror real-world bank tiers.
