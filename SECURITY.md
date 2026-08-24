# Security policy

The Diffra team takes security and data privacy seriously. This document outlines our security policies, supported versions, and how to report vulnerabilities responsibly.

---

## Supported versions

Security updates and patches are actively applied to the following release lines:

| Version | Supported | Notes |
| :--- | :--- | :--- |
| `0.1.x` | Yes | Active development line |
| `< 0.1.0` | No | Legacy preview builds |

---

## Reporting a vulnerability

If you discover a security vulnerability within Diffra, please **do not open a public issue**. Publicly disclosing a vulnerability can put user systems at risk.

Instead, please report vulnerabilities through one of the following channels:

1. **GitHub Security Advisories**: Submit a private advisory via [GitHub Security Advisories](https://github.com/Diffra/core/security/advisories/new).
2. **Email**: Contact the security team directly at `security@diffra.dev`.

### Report contents

To help us triage and resolve the issue quickly, please include:

* A clear description of the vulnerability and its potential impact.
* Step-by-step reproduction steps or a minimal proof-of-concept (PoC).
* Affected packages and versions (e.g. `@diffra/cli`, `@diffra/action`, `@diffra/core`).
* Any proposed mitigations or patch suggestions.

---

## Response timeline

* **Initial response**: Within 48 hours of report submission.
* **Triage and reproduction**: Within 5 business days.
* **Patch release and disclosure**: Coordinated timeline following validation of the fix.

---

## Security architectural guarantees

* **Path traversal protection**: All internal preview and static servers strictly validate and canonicalize requested paths within designated root boundaries.
* **Secret masking**: Automated CI workflows and GitHub Actions register tokens with `setSecret` to prevent credential exposure in build logs.
* **Zero telemetry**: Diffra does not collect, transmit, or store usage data, source code, or snapshot images on external servers. All operations execute entirely on your own infrastructure.
