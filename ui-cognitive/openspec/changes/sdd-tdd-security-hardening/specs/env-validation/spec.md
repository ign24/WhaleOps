## ADDED Requirements

### Requirement: Required environment variables SHALL be validated at module load

A centralized environment configuration module MUST validate that required environment variables are present. In production (`NODE_ENV === "production"`), missing required variables MUST cause a thrown error at import time. In development, missing variables MAY fall back to defaults.

#### Scenario: Production server fails fast on missing NAT_BACKEND_URL
- **WHEN** the server starts in production mode without `NAT_BACKEND_URL` set
- **THEN** the module SHALL throw an error with message indicating which variable is missing

#### Scenario: Development server uses fallback
- **WHEN** the server starts in development mode without `NAT_BACKEND_URL` set
- **THEN** the module SHALL fall back to `http://127.0.0.1:8000`

#### Scenario: All variables present
- **WHEN** the server starts with all required environment variables set
- **THEN** the module SHALL export the validated values without error
