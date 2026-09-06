---
name: Standalone Expo builds
description: API URL and packaging constraints for releasing the Expo app outside the Replit preview.
---

## Rule

Android and iOS builds must receive `EXPO_PUBLIC_DOMAIN` at build time, pointing to the stable HTTPS API hostname. The client must fail clearly when native configuration is missing rather than silently using a temporary development domain.

**Why:** Native apps run outside the Replit preview proxy, and a baked-in temporary hostname can make a release appear configured while later becoming unreachable.

**How to apply:** Keep the hostname out of source control and provide it through the build environment. Separately hosted web builds may use the same variable; same-origin web hosting can use `/api` routing when no explicit domain is supplied.