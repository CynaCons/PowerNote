# Security

PowerScroll is a local-first application. A notebook is an HTML application
containing both the editor and the user's data, so users should open notebooks
only from people they trust—just as they would an executable document.

Normal editing does not require an account or a PowerScroll server. Network
access is used for explicit update checks, installing optional extensions, and
the local MCP bridge when the user enables it. The bridge listens only on the
loopback interface and is disabled in the notebook by default.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could put users or
their notebooks at risk. Use GitHub's private vulnerability reporting for this
repository. Include the affected version, reproduction steps, impact, and any
suggested mitigation. You can expect an initial response within seven days.

## Release verification

Each release publishes a self-contained `PowerScroll.html` file and its SHA-256
digest in GitHub's release metadata. Source and the committed standalone build
are available at the matching version tag.
