# Contributing to SRE Backup Dashboard

Thank you for your interest in contributing to the **SRE Backup & Infrastructure Observability Platform**!

## Development Workflow

1. Fork the repository and create your branch from `main`.
2. Ensure you have Python 3.11+ and Node.js 20+ installed.
3. Install backend dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
4. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```
5. Run the local development server:
   ```bash
   python app.py
   ```

## Commit Guidelines

We enforce the Conventional Commits specification:
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring without behavioral alterations
- `perf:` Performance improvements
- `test:` Adding or updating tests

## Pull Request Checklist

- [ ] Code follows project clean code standards.
- [ ] No hardcoded company identities, credentials, or private internal IP addresses.
- [ ] Frontend builds successfully (`npm run build`).
- [ ] Documentation updated if introducing new features.
