# features

Feature-scoped modules such as donations, claims, pickup scheduling and donor profiles. A
feature keeps its own components, state handling and types together so that changes stay
local, and depends on shared code through `components/`, `hooks/`, `lib/` and `services/`
rather than the other way round.
