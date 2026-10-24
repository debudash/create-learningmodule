/** What a server action tells the page: success (with an optional note) or why it was refused. */
export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };
