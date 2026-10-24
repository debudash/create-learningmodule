# Identity is a seeded user chosen at sign-in, treated as supplied by an upstream system

Sign-in selects a seeded user (Editor or Approver) and stores it in a signed cookie that both the web app and the collaboration server verify. Real authentication is out of scope; the system trusts the session's identity but authorises every action against that user's role on the server. Adding SSO later replaces only the session module.
