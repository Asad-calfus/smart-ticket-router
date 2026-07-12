# Seed data

The demo dataset (customers, products, incidents, knowledge documents, and
30+ historical / 20+ demo tickets) is defined and loaded by
[`backend/app/db/seed.py`](../backend/app/db/seed.py), not by SQL files in
this folder.

Keeping the seed data next to the SQLAlchemy models it depends on (rather
than as standalone JSON/SQL here) avoids the data drifting out of sync with
the schema. See the main [README](../README.md) for how to run it.
