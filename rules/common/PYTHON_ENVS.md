# Python Environment Rule

**RULE:** All Python dependencies MUST be installed in a local, project-specific Python environment. Never install packages globally.

## Why

- **Isolation:** Project dependencies don't conflict with system or other projects
- **Reproducibility:** Exact versions lock via `requirements.txt` or `pyproject.toml`
- **Portability:** Works across machines without system-wide setup
- **CI/CD:** Automated environments match local dev exactly
- **Safety:** Prevents system Python contamination

## Enforcement

### ❌ Never Do This

```bash
pip install requests
pip install -g boto3
python -m pip install pandas
```

### ✅ Always Do This

**Create environment (once per project):**
```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

**Install dependencies:**
```bash
pip install requests boto3 pandas
```

**Freeze dependencies:**
```bash
pip freeze > requirements.txt
```

**On a different machine:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## With `pyenv` (Recommended)

If using pyenv for version management:
```bash
pyenv local 3.11.0
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Document Python version in `.python-version` (checked in).

## Verification

Check for global installs:
```bash
# Should be empty or minimal (system only)
pip list --not-required
```

Activated environment should show:
```bash
which python
# /path/to/project/venv/bin/python

python --version
# Python 3.11.0
```

## CI/CD

In CI pipelines:
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# ... run tests/scripts
```

Never use system Python in CI.

## No Exceptions

- "It's just a quick script" → Still needs venv
- "It's already globally installed" → Create venv anyway, reinstall
- "We'll handle it later" → Do it now
- "This is the only project that uses it" → Venv doesn't hurt

**All Python code in this ecosystem follows this rule.**

## Checking In Dependencies

`requirements.txt` or `pyproject.toml` MUST be committed:
```bash
git add requirements.txt
git commit -m "chore: add Python dependencies"
```

Do NOT commit `venv/` directory:
```
# In .gitignore
venv/
.venv/
env/
```

## Further Reading

- https://docs.python.org/3/tutorial/venv.html
- https://pip.pypa.io/en/latest/
- https://python-poetry.org/ (alternative to pip + requirements.txt)
