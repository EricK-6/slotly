-- btree_gist lets a GiST index combine "=" on a plain column (resource_id)
-- with "&&" (overlaps) on a range. The exclusion constraint below needs both.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE resources (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                text NOT NULL UNIQUE,
  category            text NOT NULL,
  location            text,
  max_booking_minutes integer NOT NULL DEFAULT 240 CHECK (max_booking_minutes > 0),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id  bigint NOT NULL REFERENCES resources (id),
  user_id      bigint NOT NULL REFERENCES users (id),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  cancelled_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_valid_range CHECK (ends_at > starts_at),

  -- The core guarantee: no two active bookings for the same resource may
  -- overlap in time. '[)' makes ranges half-open, so a booking ending at 10:00
  -- and the next one starting at 10:00 do not conflict. Cancelled bookings are
  -- excluded, which frees their slot without deleting history.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (cancelled_at IS NULL)
);

CREATE INDEX bookings_user_id_idx ON bookings (user_id);
