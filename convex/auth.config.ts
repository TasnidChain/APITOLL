// Clerk authentication configuration for Convex
// This tells Convex to accept JWTs issued by our Clerk application.
// The domain is set via CLERK_JWT_ISSUER_DOMAIN environment variable
// in the Convex dashboard.

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
