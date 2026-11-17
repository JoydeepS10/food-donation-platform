# services

Business logic and data access. Services enforce the rules of the domain — who may claim a
listing, when a donation expires, what state transitions are allowed — and own the Prisma
queries that persist those rules. They are written so they can be called and tested without
an HTTP request.
