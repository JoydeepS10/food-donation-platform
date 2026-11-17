# routes

HTTP route definitions. Each file groups the paths for one area of the API, attaches the
relevant middleware and validator chains, and points at a controller handler. Routes stay
thin: they describe the shape of the HTTP surface and contain no business logic.
