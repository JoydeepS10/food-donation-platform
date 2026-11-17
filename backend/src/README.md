# src

The source root of the backend. Request handling flows in one direction here: a route
declares the path and hands off to a controller, the controller validates and delegates to a
service, and the service owns the business logic and database access. Configuration,
middleware and small shared helpers sit alongside those layers.
