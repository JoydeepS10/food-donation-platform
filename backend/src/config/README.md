# config

Environment loading and application configuration: typed access to environment variables,
the database connection settings, server options and any feature flags. Configuration is read
once at startup, validated there, and imported by the rest of the application rather than
being read from `process.env` ad hoc.
