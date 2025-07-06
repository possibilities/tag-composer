#!/bin/bash
# Test helper script to generate predictable errors for testing
# Usage: error-generator.sh --exit-code N [--stdout "message"] [--stderr "message"]

EXIT_CODE=0
STDOUT_MSG=""
STDERR_MSG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --exit-code)
      EXIT_CODE="$2"
      shift 2
      ;;
    --stdout)
      STDOUT_MSG="$2"
      shift 2
      ;;
    --stderr)
      STDERR_MSG="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Output to stdout if message provided
if [ -n "$STDOUT_MSG" ]; then
  echo "$STDOUT_MSG"
fi

# Output to stderr if message provided
if [ -n "$STDERR_MSG" ]; then
  echo "$STDERR_MSG" >&2
fi

# Exit with the specified code
exit "$EXIT_CODE"