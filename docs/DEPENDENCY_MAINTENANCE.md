# Dependency maintenance notes

## UUID security override

The lockfile previously resolved uuid versions 8.3.2 and 10.0.0 through the
Minecraft authentication dependency tree. Both are in the affected range for
GHSA-w5hq-g745-h8pq. The repository now overrides those transitive resolutions
to the fixed uuid 11.1.1 release.

Version 11.1.1 is deliberately used rather than uuid 12 or newer: uuid 11.1.1
contains the fix and retains CommonJS support, which is required by the current
Minecraft authentication packages. The new compatibility test confirms that
the lockfile has a single patched UUID resolution and that the Yggdrasil and
MSAL packages still load. This is a dependency-compatibility guard, not a
replacement for a live Microsoft/Xbox authentication test.

Remove this override only after the upstream Minecraft authentication
dependencies resolve patched UUID releases themselves and a fresh lockfile plus
authentication checks confirm the replacement.

## protobufjs install script

The current dependency tree resolves protobufjs 7.6.6 through @google/genai.
I inspected the postinstall script from the exact locked release. It only reads
the project package.json and emits a compatibility warning when the project
directly declares an incompatible protobufjs version; it does not download
files, build native code, or generate runtime artifacts. This project does not
directly declare protobufjs.

The package therefore has an explicit allowScripts denial in package.json.
Keep the default install-script protection in place. Revisit the denial only if
the dependency graph changes and the package maintainers document a required
installation side effect.

## Routine checks

Run these after changing dependencies:

```sh
npm ci
npm audit --omit=dev --audit-level=moderate
npm test
```
