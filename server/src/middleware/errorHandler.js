import { HttpError } from "../lib/errors.js";

// Map common Postgres errors to friendly HTTP responses.
const PG_ERRORS = {
  23505: [409, "A record with that value already exists"], // unique_violation
  23503: [400, "Referenced record does not exist"], // foreign_key_violation
  23514: [400, "Value is not allowed"], // check_violation
  "22P02": [400, "Invalid input"], // invalid_text_representation
  22007: [400, "Invalid date or time"], // invalid_datetime_format
  22008: [400, "Date or time out of range"],
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
}

// Express recognises error handlers by their 4 arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { message: err.message, ...(err.details && { details: err.details }) },
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { message: "Malformed JSON body" } });
  }
  const pg = PG_ERRORS[err.code];
  if (pg) {
    const message = err.code === "23505" ? duplicateMessage(err) : pg[1];
    return res.status(pg[0]).json({ error: { message } });
  }
  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
}

function duplicateMessage(err) {
  const m = err.detail?.match(/\((?:lower\()?(\w+)\)?\)=\((.*)\)/);
  if (!m) return "Duplicate value";
  const field = m[1].replace("_", " ");
  return `${field[0].toUpperCase()}${field.slice(1)} "${m[2]}" is already in use`;
}
