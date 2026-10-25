/**
 * Text people wrote, made safe to place inside a prompt tag.
 *
 * LCG-24: Lesson and Outline text went into the review's tags as written, so a
 * Lesson containing "</lesson>" could end its tag and address the reviewer
 * directly, for example to pass its own review. Escaping the tag characters keeps
 * every word visible to the model but leaves no way to close a tag.
 */
export function asData(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
