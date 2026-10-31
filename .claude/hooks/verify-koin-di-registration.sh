#!/bin/bash
# hooks/backend/verify-koin-di-registration.sh
# Verifies every new usecase/datasource/repository is registered in Koin modules.
# Define this as a Stop hook in the backend-implementer agent's frontmatter.
# Missing DI registration causes runtime failures when routes try to inject.

set -e

input=$(cat)

# Check if we're in backend directory
if ! grep -q "backend" <<< "$(pwd)"; then
  exit 0
fi

di_dir="backend/src/main/kotlin/org/mobyle/data/di"
app_module="backend/src/main/kotlin/org/mobyle/presentation/di"

if [ ! -d "$di_dir" ] || [ ! -d "$app_module" ]; then
  exit 0
fi

# Look for any newly created files in domain, data, or presentation layers
new_files=$(echo "$input" | jq -r '.created_files[]? // empty' 2>/dev/null || echo "")

missing=""

# Check for new usecases that might not be registered
for file in $new_files; do
  if [[ "$file" =~ domain/usecase/.*\.kt$ ]]; then
    class_name=$(grep -o "^class [A-Za-z0-9]*" "$file" | cut -d' ' -f2 || echo "")

    if [ -z "$class_name" ]; then
      continue
    fi

    # Check if class is registered in AppModule
    if ! grep -r "$class_name" "$app_module" >/dev/null 2>&1; then
      missing="$missing\n  - Usecase not registered in AppModule: $class_name"
    fi
  fi

  # Check for new datasources
  if [[ "$file" =~ data/remote/.*Impl\.kt$ ]]; then
    class_name=$(grep -o "^class [A-Za-z0-9]*" "$file" | cut -d' ' -f2 || echo "")
    interface_name=$(grep "implements " "$file" | grep -o "[A-Za-z0-9]*$" || echo "")

    if [ -z "$class_name" ]; then
      continue
    fi

    # Check if datasource is registered in DataModule
    if ! grep -r "$class_name\|$interface_name" "$di_dir" >/dev/null 2>&1; then
      missing="$missing\n  - DataSource not registered in DataModule: $class_name"
    fi
  fi

  # Check for new repositories
  if [[ "$file" =~ data/repository/.*Impl\.kt$ ]]; then
    class_name=$(grep -o "^class [A-Za-z0-9]*" "$file" | cut -d' ' -f2 || echo "")

    if [ -z "$class_name" ]; then
      continue
    fi

    # Check if repository is registered in DataModule
    if ! grep -r "$class_name" "$di_dir" >/dev/null 2>&1; then
      missing="$missing\n  - Repository not registered in DataModule: $class_name"
    fi
  fi
done

if [ -n "$missing" ]; then
  echo -e "❌ Koin DI Registration Issues:$missing" >&2
  echo -e "\nUpdate Koin modules:" >&2
  echo "  - backend/src/main/kotlin/org/mobyle/data/di/DataModule.kt" >&2
  echo "  - backend/src/main/kotlin/org/mobyle/presentation/di/AppModule.kt" >&2
  exit 1
fi

exit 0
