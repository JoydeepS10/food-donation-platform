# API Notes — Food Donation Coordination API

`openapi.yaml` is the source of truth for the HTTP contract. This file explains the
conventions that the schema cannot express on its own.

## 1. Base conventions

- Base path: `/api/v1`; local server `http://localhost:4000/api/v1`.
- JSON request and response bodies (`application/json`) except document upload/download and
  binary file responses.
- IDs are UUID strings. Timestamps are ISO-8601 UTC strings. Dates are not used for
  time-sensitive fields.
- Authentication uses an opaque session cookie named `fd_session` (`HttpOnly`, `Secure` in
  production, `SameSite=Lax`). Public endpoints do not require it; protected endpoints
  return `401` without a valid session.
- One login exists per organisation. A user belongs to exactly one organisation unless the
  role is `admin`.
- Role and verification rules are enforced server-side; hiding UI is never sufficient.

## 2. Auth in development vs production

The `fd_session` cookie is the only credential; clients never send a bearer token.

| Setting | Development (`http://localhost:4000`) | Production (HTTPS) |
| --- | --- | --- |
| `HttpOnly` | `true` | `true` |
| `Secure` | `false` | `true` |
| `SameSite` | `Lax` | `Lax` |
| `Path` | `/` | `/` |
| CORS allowed origin | The frontend dev origin, for example `http://localhost:5173` | The deployed frontend origin only |

- The frontend must send `credentials: 'include'` on every fetch/XHR call. Without it the
  browser neither stores `fd_session` on login nor sends it on later requests.
- CORS must name the frontend origin explicitly and return
  `Access-Control-Allow-Credentials: true`. A wildcard `*` origin cannot be used with
  credentials.
- Development runs over plain HTTP, so `Secure` must be off or the browser drops the cookie.
  Production must run over HTTPS, because `Secure` cookies are ignored on plain HTTP.
- `SameSite=Lax` is enough while the frontend and API share a site (different ports on
  `localhost`, or subdomains of one domain). A genuinely cross-site frontend would need
  `SameSite=None; Secure`; agree that change with the project owner before applying it.
- `POST /auth/logout` clears the cookie with the same attributes.

## 3. Operation metadata

Every operation declares all three custom fields.

| Field | Type | Meaning |
| --- | --- | --- |
| `x-slice` | integer 1–6 | Delivery slice. Slice 6 adds no endpoints. |
| `x-required-roles` | array of `public`, `donor`, `ngo`, `admin` | Roles allowed to call the endpoint. `public` means anonymous access is allowed; authenticated roles listed alongside it receive an extended projection where documented. |
| `x-requires-verified-organisation` | boolean | When `true`, a caller belonging to an organisation must have `verificationStatus = verified`. Applies only to donor/NGO callers; admins and public callers are exempt. |

Every protected operation also uses `security: [{ sessionCookie: [] }]`. Operations that
allow anonymous access use `security: [{ sessionCookie: [] }, {}]` so an optional session
can extend the response.

Slice 6 contains integration, hardening, tests and polish only. It must not introduce a new
path or operation.

## 4. Shared error format

Every non-2xx response from every endpoint uses this envelope. There are no bare strings,
HTML error pages or ad-hoc shapes.

```json
{
  "error": {
    "code": "DONATION_ALREADY_CLAIMED",
    "message": "This donation has already been claimed.",
    "requestId": "6c1f7a1e-5b41-4a9b-b06c-5f7e5e1f6a2d",
    "details": [
      {
        "field": "pickupWindow.end",
        "message": "Must be later than the start time."
      }
    ]
  }
}
```

Rules:

- `error.code` is a stable, upper-snake-case machine code. Clients branch on it.
- `error.message` is safe to display to the user and never contains stack traces, SQL or PII.
- `error.requestId` is always present and matches the server log entry.
- `error.details` is optional; it is present mainly for field validation. Each item has a
  `field` (JSON path or query/header name) and a human-readable `message`.
- The same envelope is used for 4xx and 5xx. A 5xx keeps a generic message; details are not
  leaked.
- Validation errors return `422 VALIDATION_FAILED` and one detail per invalid field.
- Malformed JSON, unknown query values or invalid UUIDs return `400 BAD_REQUEST`.
- Authentication failures return `401 UNAUTHENTICATED`; role and verification failures
  return `403 FORBIDDEN` with a specific code such as `ORGANISATION_NOT_VERIFIED`.

### Shared error responses

| Component | Status | Typical codes |
| --- | --- | --- |
| `BadRequest` | 400 | `BAD_REQUEST` |
| `Unauthorized` | 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED` |
| `Forbidden` | 403 | `FORBIDDEN`, `ORGANISATION_NOT_VERIFIED` |
| `NotFound` | 404 | `NOT_FOUND`, `DONATION_NOT_FOUND`, `DOCUMENT_NOT_FOUND` |
| `Conflict` | 409 | `DONATION_ALREADY_CLAIMED`, `INVALID_STATUS_TRANSITION`, `DUPLICATE_EMAIL` |
| `PayloadTooLarge` | 413 | `FILE_TOO_LARGE` |
| `UnsupportedMediaType` | 415 | `UNSUPPORTED_FILE_TYPE` |
| `UnprocessableEntity` | 422 | `VALIDATION_FAILED` |
| `TooManyRequests` | 429 | `RATE_LIMITED` |
| `InternalServerError` | 500 | `INTERNAL_ERROR` |

## 5. Pagination and filters

List endpoints use the same query and envelope.

Query parameters:

- `page`: integer, default `1`, minimum `1`.
- `pageSize`: integer, default `20`, minimum `1`, maximum `50`.

Envelope:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Filters are applied server-side. Unknown filter values return `400`. `status` filters are
restricted by role as described per endpoint.

## 6. Slices and endpoint ownership

| Slice | Feature area | Operations | Count |
| --- | --- | --- | --- |
| 1 | Health and authentication | `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | 5 |
| 2 | Donations | `GET /donations`, `POST /donations`, `GET /donations/{donationId}`, `PATCH /donations/{donationId}`, `POST /donations/{donationId}/cancel` | 5 |
| 3 | Claims and lifecycle actions | `POST /donations/{donationId}/claims`, `PATCH /donations/{donationId}/status`, `GET /claims/me` | 3 |
| 4 | Organisation, documents and verification | `GET /organisations/me`, `PATCH /organisations/me`, `POST /organisations/me/documents`, `GET /organisations/me/documents/{documentId}/download`, `POST /organisations/me/verification`, `GET /admin/organisations`, `GET /admin/organisations/{organisationId}`, `GET /admin/organisations/{organisationId}/documents/{documentId}/download`, `POST /admin/organisations/{organisationId}/verification` | 9 |
| 5 | Notifications | `GET /notifications`, `POST /notifications/{notificationId}/read`, `POST /notifications/read-all` | 3 |
| 6 | No new endpoints | Integration, hardening, tests, documentation and demo polish only | 0 |
| **Total** | | | **25** |

## 7. Role-aware donation projections

`GET /donations` and `GET /donations/{donationId}` intentionally share a path across roles.

- **Anonymous and non-claimant NGO:** only `available` donations; masked area/city; no street
  address, postcode, instructions or contact details.
- **Donor owner:** own donations in every status; full pickup details and claiming NGO
  summary.
- **NGO with the active claim:** full pickup details and donor contact only while the claim
  is active.
- **Admin:** all statuses and full details for oversight.
- **`mine=true`:** only an authenticated donor may use it; returns that donor's donations in
  all statuses.
- **`status` filter:** only an authenticated donor using `mine=true` or an admin may request a
  status other than `available`; others receive `403 FORBIDDEN`.

List items always use the summary projection. Full details are returned only by the detail
endpoint.

## 8. Upload and download rules

- Verification documents: PDF, JPEG or PNG; maximum 10 MB; one current document per
  document type. A replacement marks the previous row non-current.
- Document downloads are authenticated; the owner sees their own organisation's documents,
  and admins can download any organisation's documents. Responses use the stored MIME type
  and `Content-Disposition: attachment`.
- File type is validated from content, not only the filename extension.

## 9. Idempotency and concurrency

- Claiming is idempotent for the same NGO: if it already holds the active claim, the request
  returns that claim instead of creating another.
- A different NGO claiming an already-claimed donation receives
  `409 DONATION_ALREADY_CLAIMED`.
- A claim at or after `pickupWindow.end` receives `409 DONATION_EXPIRED`.
- Status changes are conditional on the current state and return
  `409 INVALID_STATUS_TRANSITION` when the requested action is not allowed.
- Clients must treat the server response as authoritative and refresh after a conflict.

## 10. Scope notes

- Notification delivery is in-app plus best-effort email; there is no real-time transport in
  this contract.
- Admin global claim listing and operational dashboard endpoints are not part of slices 1–5.
  Admin oversight of a specific donation is available through `GET /donations` and
  `GET /donations/{donationId}` with the admin projection, plus the cancel endpoint.
- Slice 6 must not add endpoints; any missing endpoint requires an explicit contract change
  agreed before implementation.
