#!/bin/bash

# Default values
exit_code=0
stdout_text=""
stderr_text=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --exit-code)
      exit_code="$2"
      shift 2
      ;;
    --stdout)
      stdout_text="$2"
      shift 2
      ;;
    --stderr)
      stderr_text="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Output to stderr if provided
if [[ -n "$stderr_text" ]]; then
  echo "$stderr_text" >&2
fi

# Output to stdout if provided
if [[ -n "$stdout_text" ]]; then
  echo "$stdout_text"
fi

# Validate exit code (must be 0-255)
if [[ "$exit_code" -lt 0 || "$exit_code" -gt 255 ]]; then
  echo "Error: Exit code must be between 0 and 255 (got $exit_code)" >&2
  exit 1
fi

# Exit with the specified code
exit "$exit_code"