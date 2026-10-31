#!/bin/bash
# hooks/backend/validate-backend-structure.sh
# Validates backend follows clean architecture with domain/data/presentation layers.
# Checks that new files land in correct directories and follow naming conventions.
# Define this as a Stop hook in the backend-implementer agent's frontmatter.

set -e

input=$(cat)

# Check if we're in backend directory
if ! grep -q "backend" <<< "$(pwd)"; then
  exit 0
fi

base_path="backend/src/main/kotlin/org/mobyle"
errors=""

# Get the file path that was just edited/created
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

if [ -z "$file_path" ]; then
  exit 0
fi

# Normalize path
file_path=$(echo "$file_path" | sed 's|\\|/|g')

# Check file is in allowed paths
if ! echo "$file_path" | grep -qE "^.*/(domain|data|presentation)/.*\.kt$"; then
  errors="$errors\nFile must be in domain/, data/, or presentation/ layer"
fi

# Check package matches directory structure
if [[ "$file_path" =~ domain/model/ ]]; then
  if ! grep -q "package org.mobyle.domain.model" "$file_path"; then
    errors="$errors\nFile in domain/model/ must declare package org.mobyle.domain.model"
  fi
elif [[ "$file_path" =~ domain/repository/ ]]; then
  if ! grep -q "package org.mobyle.domain.repository" "$file_path"; then
    errors="$errors\nFile in domain/repository/ must declare package org.mobyle.domain.repository"
  fi
elif [[ "$file_path" =~ domain/usecase/ ]]; then
  if ! grep -q "package org.mobyle.domain.usecase" "$file_path"; then
    errors="$errors\nFile in domain/usecase/ must declare package org.mobyle.domain.usecase"
  fi
elif [[ "$file_path" =~ data/remote/ ]]; then
  if ! grep -q "package org.mobyle.data.remote" "$file_path"; then
    errors="$errors\nFile in data/remote/ must declare package org.mobyle.data.remote"
  fi
elif [[ "$file_path" =~ data/repository/ ]]; then
  if ! grep -q "package org.mobyle.data.repository" "$file_path"; then
    errors="$errors\nFile in data/repository/ must declare package org.mobyle.data.repository"
  fi
elif [[ "$file_path" =~ presentation/routing/ ]]; then
  if ! grep -q "package org.mobyle.presentation.routing" "$file_path"; then
    errors="$errors\nFile in presentation/routing/ must declare package org.mobyle.presentation.routing"
  fi
fi

# Check file naming conventions
filename=$(basename "$file_path")

# Files should be PascalCase.kt or camelCase.kt
if [[ "$filename" =~ ^[a-z_]*\.kt$ ]] && ! [[ "$filename" =~ ^[a-z]+[a-z0-9]*\.kt$ ]]; then
  errors="$errors\nFile name should be camelCase.kt or PascalCase.kt (found: $filename)"
fi

# Check for one class per file (warn only)
class_count=$(grep -c "^class \|^interface \|^enum class \|^sealed class " "$file_path" || echo "0")
if [ "$class_count" -gt 1 ]; then
  echo "⚠️  Multiple classes in one file: $filename (consider splitting)" >&2
fi

# Check for suspend functions in data layer (should be there)
if [[ "$file_path" =~ data/remote/ ]] || [[ "$file_path" =~ data/repository/ ]]; then
  if ! grep -q "suspend fun" "$file_path" && ! grep -q "interface " "$file_path"; then
    errors="$errors\nData layer implementations should use suspend functions"
  fi
fi

if [ -n "$errors" ]; then
  echo -e "❌ Backend Structure Issues:$errors" >&2
  exit 1
fi

exit 0
