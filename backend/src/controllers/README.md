# controllers

The HTTP edge of the application. Controllers read the validated request, call the
appropriate service, and turn the result into the response shape defined by the API contract.
They handle status codes and response formatting only; business rules and database queries
belong in services.
